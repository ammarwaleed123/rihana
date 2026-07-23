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
 * Change the caller's own email.
 *
 * Returns a discriminated result rather than throwing on a duplicate, because
 * "that address is already in use" is a normal outcome a form should render —
 * and because the caller decides how much to say. See the note at the call
 * site about not confirming which addresses exist.
 */
export async function changeMyEmail(
  session: Session,
  email: string,
): Promise<{ ok: true; from: string; to: string } | { ok: false }> {
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (!current) throw new ForbiddenError();
  if (current.email === email) return { ok: true, from: email, to: email };

  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (taken) return { ok: false };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { email },
  });

  return { ok: true, from: current.email, to: email };
}

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
