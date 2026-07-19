import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Fixed-window rate limiting on Postgres.
 *
 * We already operate a database; adding Redis for this would be infrastructure
 * we have to run, monitor and secure for the sake of one counter. At this scale
 * (a few thousand families) a single indexed upsert per attempt is negligible.
 *
 * Lives in lib/data/ because it is the one part of the auth stack that talks to
 * the database directly.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Identifiers are hashed before storage. Rate-limit keys would otherwise be a
 * plaintext list of every email address that has ever attempted a login.
 */
function buildKey(scope: string, identifier: string): string {
  const digest = createHash("sha256")
    .update(`${env.SESSION_SECRET}:${scope}:${identifier.toLowerCase()}`, "utf8")
    .digest("hex");

  return `${scope}:${digest}`;
}

/**
 * Consume one unit against a limit.
 *
 * The window is advanced atomically: a single upsert either starts a fresh
 * window or increments the current one, so concurrent requests cannot each
 * observe "window expired" and reset the counter to 1.
 */
export async function consumeRateLimit(
  scope: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = buildKey(scope, identifier);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  // `count` resets when the stored window has aged out, otherwise increments.
  const [row] = await prisma.$queryRaw<
    Array<{ count: number; windowStart: Date }>
  >`
    INSERT INTO rate_limits ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN rate_limits."windowStart" < ${windowStart} THEN 1
        ELSE rate_limits."count" + 1
      END,
      "windowStart" = CASE
        WHEN rate_limits."windowStart" < ${windowStart} THEN ${now}
        ELSE rate_limits."windowStart"
      END,
      "expiresAt" = ${expiresAt}
    RETURNING "count", "windowStart"
  `;

  const count = row?.count ?? 1;
  const startedAt = row?.windowStart ?? now;
  const resetAt = startedAt.getTime() + windowSeconds * 1000;

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
  };
}

/**
 * Clear a limit after a legitimate success, so one person's typo does not eat
 * the allowance they need to actually get in.
 */
export async function resetRateLimit(
  scope: string,
  identifier: string,
): Promise<void> {
  await prisma.rateLimit
    .delete({ where: { key: buildKey(scope, identifier) } })
    .catch(() => {
      // Nothing to clear. Not an error.
    });
}

/** Housekeeping for expired windows. Called from the maintenance job. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
