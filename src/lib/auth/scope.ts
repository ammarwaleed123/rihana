import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { Role } from "@/generated/prisma/client";
import { readSessionCookie } from "@/lib/auth/cookies";
import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/errors";
import type { Session } from "@/lib/data/sessions";
import { validateSessionToken } from "@/lib/data/sessions";

/**
 * The authorization entry point for the entire application.
 *
 * Every scoped read starts here. The scope resolvers below (childIdsForParent,
 * classIdsForTeacher, ...) are the *only* sanctioned answers to "what may this
 * person see", and the data layer is the only place allowed to call them.
 *
 * See docs/architecture.md. Changing anything in this file changes who can see
 * photographs of other people's children — treat it accordingly.
 */

/**
 * Current session, or null.
 *
 * Wrapped in React's `cache` so that a page, its layout and every server
 * component in one render share a single database round-trip instead of each
 * re-validating the cookie. The cache is per-request, so it cannot leak one
 * user's session into another's request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = await readSessionCookie();
  if (!token) return null;
  return validateSessionToken(token);
});

/** Session or redirect to sign-in. For pages. */
export async function requireSession(returnTo?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const target = returnTo
      ? `/signin?next=${encodeURIComponent(returnTo)}`
      : "/signin";
    redirect(target);
  }
  return session;
}

/** Session or throw. For server actions and route handlers, which must not redirect. */
export async function requireSessionOrThrow(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return session;
}

export function requireRole(session: Session, ...roles: Role[]): Session {
  if (!roles.includes(session.user.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export function isStaff(session: Session): boolean {
  return session.user.role === "OWNER" || session.user.role === "TEACHER";
}

export function isOwner(session: Session): boolean {
  return session.user.role === "OWNER";
}

/**
 * Page-level guards.
 *
 * These redirect rather than throw, and they send an authenticated user who
 * lands in the wrong zone to their own home rather than to sign-in — being
 * bounced to a login form while already logged in is baffling.
 */
export async function requireParent(returnTo?: string): Promise<Session> {
  const session = await requireSession(returnTo);
  if (session.user.role !== "PARENT") redirect("/admin");
  return session;
}

export async function requireStaff(returnTo?: string): Promise<Session> {
  const session = await requireSession(returnTo);
  if (!isStaff(session)) redirect("/portal");
  return session;
}

export async function requireOwner(returnTo?: string): Promise<Session> {
  const session = await requireSession(returnTo);
  if (!isOwner(session)) redirect("/admin");
  return session;
}

/** Where a given role belongs after signing in. */
export function homePathForRole(role: Role): string {
  return role === "PARENT" ? "/portal" : "/admin";
}
