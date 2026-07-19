import "server-only";

import type { Role, UserStatus } from "@/generated/prisma/client";
import { hashToken, issueToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Server-side session storage.
 *
 * The cookie carries a random 256-bit token; the database stores only its
 * SHA-256 as the primary key. Consequences worth stating plainly:
 *
 *  - A read-only database leak yields no usable sessions.
 *  - Sessions are revocable server-side, immediately, which a JWT is not.
 *    That matters here: a parent losing custody rights, or a teacher leaving,
 *    must lose access now, not whenever a token happens to expire.
 */

/** Everything the app needs about the caller. Never contains the token. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
};

export type Session = {
  id: string;
  expiresAt: Date;
  user: SessionUser;
};

const TTL_MS = () => env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Refresh the expiry once a session is more than halfway through its life.
 *
 * Sliding expiry keeps parents signed in on their phones without issuing
 * effectively-immortal sessions, and writing only past the halfway point keeps
 * this from being a database write on every single request.
 */
const REFRESH_THRESHOLD_RATIO = 0.5;

export async function createSession(
  userId: string,
  meta: { ipHash?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = issueToken();
  const expiresAt = new Date(Date.now() + TTL_MS());

  await prisma.session.create({
    data: {
      id: hash,
      userId,
      expiresAt,
      ipHash: meta.ipHash ?? null,
      // Truncated: a User-Agent is attacker-controlled and unbounded.
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });

  return { token, expiresAt };
}

/**
 * Resolve a raw cookie token to a session, or null.
 *
 * Returns null — never throws — for expired, unknown, disabled and
 * soft-deleted cases alike, so callers cannot accidentally branch on the reason.
 */
export async function validateSessionToken(
  token: string,
): Promise<Session | null> {
  if (!token) return null;

  const id = hashToken(token);

  const row = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!row) return null;

  // Expired: delete on read rather than waiting for the sweeper.
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  // A disabled or deleted account must lose access immediately, even though the
  // session row itself is still valid.
  if (row.user.deletedAt || row.user.status !== "ACTIVE") {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  let expiresAt = row.expiresAt;
  const ttl = TTL_MS();
  const elapsed = ttl - (expiresAt.getTime() - Date.now());

  if (elapsed > ttl * REFRESH_THRESHOLD_RATIO) {
    expiresAt = new Date(Date.now() + ttl);
    await prisma.session
      .update({ where: { id }, data: { expiresAt } })
      .catch(() => {
        // A failed refresh is harmless — the session simply expires on schedule.
      });
  }

  return {
    id: row.id,
    expiresAt,
    user: {
      id: row.user.id,
      email: row.user.email,
      name: row.user.name,
      role: row.user.role,
      status: row.user.status,
    },
  };
}

export async function invalidateSession(token: string): Promise<void> {
  await prisma.session
    .delete({ where: { id: hashToken(token) } })
    .catch(() => {
      // Already gone. Signing out twice is not an error.
    });
}

/**
 * Drop every session for a user.
 *
 * Called on password change, on role change, and when an account is disabled —
 * the "session rotation on privilege change" requirement. Any device holding an
 * old session loses it at once.
 */
export async function invalidateAllSessionsForUser(
  userId: string,
): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

/** Housekeeping for expired rows. Called from the maintenance job. */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
