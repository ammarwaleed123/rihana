import "server-only";

import {
  hashPassword,
  needsRehash,
  verifyPassword,
  verifyPasswordDummy,
} from "@/lib/auth/password";
import { hashToken, issueToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { invalidateAllSessionsForUser } from "@/lib/data/sessions";

/**
 * Authentication reads and writes.
 *
 * Every function here returns a discriminated result rather than throwing on
 * "wrong credentials". Callers must map *all* failure variants onto one generic
 * message; the variants exist for logging and rate-limit accounting, not to be
 * shown to the person typing.
 */

export type AuthOutcome =
  | { ok: true; userId: string; role: "OWNER" | "TEACHER" | "PARENT" }
  | {
      ok: false;
      reason:
        | "unknown_email"
        | "wrong_password"
        | "not_activated"
        | "disabled"
        | "locked";
      /** Only set for "locked". */
      lockedUntil?: Date;
    };

/** How many consecutive failures before an account is temporarily locked. */
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MINUTES = 15;

/**
 * Verify an email and password.
 *
 * Both the unknown-email and wrong-password paths perform a full argon2
 * verification, so they cost the same wall-clock time. Skipping the hash for an
 * unknown address would make the login form an account-existence oracle.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthOutcome> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      role: true,
      status: true,
      passwordHash: true,
      failedLoginCount: true,
      lockedUntil: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    await verifyPasswordDummy(password);
    return { ok: false, reason: "unknown_email" };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await verifyPasswordDummy(password);
    return { ok: false, reason: "locked", lockedUntil: user.lockedUntil };
  }

  // INVITED users have no password yet; DISABLED users are denied outright.
  if (!user.passwordHash || user.status === "INVITED") {
    await verifyPasswordDummy(password);
    return { ok: false, reason: "not_activated" };
  }

  if (user.status === "DISABLED") {
    await verifyPasswordDummy(password);
    return { ok: false, reason: "disabled" };
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_LOGINS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null,
      },
    });

    return { ok: false, reason: "wrong_password" };
  }

  // Success: clear the failure counter and opportunistically upgrade the hash
  // if the cost parameters have been raised since it was written.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(needsRehash(user.passwordHash)
        ? { passwordHash: await hashPassword(password) }
        : {}),
    },
  });

  return { ok: true, userId: user.id, role: user.role };
}

/**
 * Confirm the signed-in user's password again.
 *
 * Guards sensitive actions (adding a pickup-authorized person, changing an
 * account email). Verified server-side inside the same action — never tracked as
 * a client-side "recently re-authenticated" flag, which the client could simply
 * assert.
 */
export async function verifyPasswordForUser(
  userId: string,
  password: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, status: true, deletedAt: true },
  });

  if (!user?.passwordHash || user.deletedAt || user.status !== "ACTIVE") {
    await verifyPasswordDummy(password);
    return false;
  }

  return verifyPassword(user.passwordHash, password);
}

/**
 * Set a password and invalidate every existing session for that user.
 *
 * The invalidation is the point: changing a password must evict whoever else
 * was signed in, which is the entire reason a person changes it under duress.
 */
export async function setPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      status: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      resetTokenHash: null,
      resetExpiresAt: null,
    },
  });

  await invalidateAllSessionsForUser(userId);
}

// ---------------------------------------------------------------------------
// Invites — this is a closed system; there is no self-registration.
// ---------------------------------------------------------------------------

const INVITE_TTL_DAYS = 14;
const RESET_TTL_MINUTES = 60;

export async function issueInviteToken(userId: string): Promise<string> {
  const { token, hash } = issueToken();

  await prisma.user.update({
    where: { id: userId },
    data: {
      inviteTokenHash: hash,
      inviteExpiresAt: new Date(
        Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
      ),
    },
  });

  return token;
}

export async function findUserByInviteToken(token: string) {
  if (!token) return null;

  const user = await prisma.user.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      inviteExpiresAt: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) return null;
  if (!user.inviteExpiresAt || user.inviteExpiresAt.getTime() < Date.now()) {
    return null;
  }

  return user;
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Issue a reset token, or quietly do nothing.
 *
 * Returns null for unknown or inactive accounts. The caller shows the same
 * "check your email" confirmation either way — otherwise the reset form becomes
 * the account-existence oracle that the login form is not.
 */
export async function issueResetToken(
  email: string,
): Promise<{ token: string; userId: string; name: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, status: true, deletedAt: true },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") return null;

  const { token, hash } = issueToken();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hash,
      resetExpiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
    },
  });

  return { token, userId: user.id, name: user.name };
}

export async function findUserByResetToken(token: string) {
  if (!token) return null;

  const user = await prisma.user.findUnique({
    where: { resetTokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      resetExpiresAt: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") return null;
  if (!user.resetExpiresAt || user.resetExpiresAt.getTime() < Date.now()) {
    return null;
  }

  return user;
}

export const AUTH_CONSTANTS = {
  MAX_FAILED_LOGINS,
  LOCKOUT_MINUTES,
  INVITE_TTL_DAYS,
  RESET_TTL_MINUTES,
} as const;
