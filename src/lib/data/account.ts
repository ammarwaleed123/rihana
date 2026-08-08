import "server-only";

import { ForbiddenError } from "@/lib/auth/errors";
import { childIdsForParent } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";

/**
 * A parent's own account and family.
 *
 * Everything here is about the caller and nobody else, so the scope is simply
 * `session.user.id` — but it is still resolved from the session rather than
 * from a form field, because "which account am I editing" is exactly the
 * parameter an attacker would like to supply.
 */

export async function getMyAccount(session: Session) {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      locale: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) throw new ForbiddenError();
  return user;
}

/**
 * The stored language for a user id.
 *
 * Takes a raw id rather than a Session because it is called during sign-in, at
 * the one moment a Session does not exist yet. The id comes from the just-
 * verified credentials, never from user input.
 */
export async function getUserLocale(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  return user?.locale ?? "en";
}

/**
 * Save the caller's interface language.
 *
 * Scoped to `session.user.id` like everything else here — the locale is never
 * taken from a user id in the form, only from the session.
 */
export async function setMyLocale(session: Session, locale: string) {
  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale },
    select: { id: true },
  });
}

/** The caller's children, with class and guardianship details for display. */
export async function getMyFamily(session: Session) {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const childIds = await childIdsForParent(session.user.id);

  const [children, guardianships] = await Promise.all([
    prisma.child.findMany({
      where: { id: { in: childIds } },
      orderBy: [{ firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        photoConsent: true,
        class: { select: { id: true, name: true } },
      },
    }),
    prisma.guardianship.findMany({
      where: { parentUserId: session.user.id },
      select: { childId: true, relationship: true, isPrimary: true },
    }),
  ]);

  const byChild = new Map(guardianships.map((g) => [g.childId, g]));

  return children.map((child) => ({
    ...child,
    relationship: byChild.get(child.id)?.relationship ?? null,
    isPrimary: byChild.get(child.id)?.isPrimary ?? false,
  }));
}

/**
 * Update the caller's own name and phone.
 *
 * Email is deliberately not here. A parent's email is issued by the nursery and
 * is the account's identity and its password-reset destination; letting a parent
 * change it themselves is a self-service account takeover from a borrowed phone,
 * so it is the nursery's to set, not the parent's.
 */
export async function updateMyContactDetails(
  session: Session,
  input: { name: string; phone: string | null },
) {
  return prisma.user.update({
    where: { id: session.user.id },
    data: { name: input.name, phone: input.phone },
    select: { id: true, name: true, phone: true },
  });
}
