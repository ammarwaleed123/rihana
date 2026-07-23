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
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) throw new ForbiddenError();
  return user;
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
