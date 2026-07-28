import "server-only";

import webpush from "web-push";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Web Push delivery.
 *
 * The proactive half of the notification system. The in-app bell
 * (data/notifications.ts) is the record of truth; this pushes the same rows to a
 * device's lock screen and keeps the home-screen badge in sync. Push is
 * best-effort and never load-bearing — every message is also a Notification row
 * the bell shows regardless, so a failed or unconfigured push loses nothing.
 *
 * Entirely optional: with no VAPID keys the whole module no-ops, which is what
 * lets dev, the e2e suite and a keyless deploy run on the bell alone.
 */

// NEXT_PUBLIC_ so the browser can read the same key to subscribe. Read from
// process.env directly because the server-only env schema forbids NEXT_PUBLIC_.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

let configured = false;

function ensureConfigured(): boolean {
  if (!PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Store (or refresh) one device's subscription for a user. */
export async function savePushSubscription(
  userId: string,
  sub: BrowserSubscription,
  userAgent?: string | null,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: {
      userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
    },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
    },
  });
}

/** Forget one device's subscription (scoped to its owner). */
export async function deletePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

type PushableRow = {
  userId: string;
  title: string;
  body: string;
  linkPath: string;
  dedupeKey: string;
};

/**
 * Send a push for freshly-created notification rows.
 *
 * Called by every fan-out right after its `createMany`. `insertedCount` is that
 * call's skipDuplicates return: 0 means every row already existed (a worker
 * retry), so nothing is re-sent — that is what keeps push idempotent with no
 * bookkeeping of its own. Each message carries the recipient's current unread
 * total as the badge count, and any endpoint that reports 404/410 (unsubscribed
 * or expired) is pruned as we find it.
 */
export async function deliverPush(
  rows: PushableRow[],
  insertedCount: number,
): Promise<void> {
  if (insertedCount <= 0 || rows.length === 0 || !ensureConfigured()) return;

  try {
    const userIds = [...new Set(rows.map((r) => r.userId))];

    const [subs, unreadGroups] = await Promise.all([
      prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
      prisma.notification.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, readAt: null },
        _count: { _all: true },
      }),
    ]);
    if (subs.length === 0) return;

    const badgeByUser = new Map(
      unreadGroups.map((g) => [g.userId, g._count._all]),
    );
    const subsByUser = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = subsByUser.get(s.userId) ?? [];
      list.push(s);
      subsByUser.set(s.userId, list);
    }

    const dead: string[] = [];

    await Promise.all(
      rows.flatMap((row) => {
        const payload = JSON.stringify({
          title: row.title,
          body: row.body,
          url: row.linkPath,
          badgeCount: badgeByUser.get(row.userId) ?? 0,
          tag: row.dedupeKey,
        });
        return (subsByUser.get(row.userId) ?? []).map((s) =>
          webpush
            .sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
            .then(() => undefined)
            .catch((error: unknown) => {
              const status = (error as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) {
                dead.push(s.id);
              } else {
                logger.warn(
                  { scope: "push", status, err: (error as Error).message },
                  "push send failed",
                );
              }
            }),
        );
      }),
    );

    if (dead.length) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    }
  } catch (error) {
    // Push is best-effort; a failure here must never break the fan-out.
    logger.warn(
      { scope: "push", err: (error as Error).message },
      "deliverPush failed",
    );
  }
}
