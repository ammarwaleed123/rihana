"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { requireSessionOrThrow } from "@/lib/auth/scope";
import { deletePushSubscription, savePushSubscription } from "@/lib/data/push";

/**
 * Subscribe / unsubscribe the current device for web push.
 *
 * Any signed-in user may subscribe — parents for photo, announcement and pickup
 * alerts; owners for pickup approvals and website enquiries. Everything is scoped
 * to the caller: the subscription is stored against their id, and only they can
 * remove it. The endpoint and keys come from the browser's own PushManager, but
 * are validated here anyway before they reach storage.
 */

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  expirationTime: z.union([z.number(), z.null()]).optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(400),
    auth: z.string().min(1).max(400),
  }),
});

export async function subscribeToPush(raw: unknown): Promise<{ ok: boolean }> {
  const session = await requireSessionOrThrow();

  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };

  const userAgent = (await headers()).get("user-agent");
  await savePushSubscription(
    session.user.id,
    { endpoint: parsed.data.endpoint, keys: parsed.data.keys },
    userAgent,
  );
  return { ok: true };
}

export async function unsubscribeFromPush(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const session = await requireSessionOrThrow();

  const parsed = z.url().max(2048).safeParse(endpoint);
  if (!parsed.success) return { ok: false };

  await deletePushSubscription(session.user.id, parsed.data);
  return { ok: true };
}
