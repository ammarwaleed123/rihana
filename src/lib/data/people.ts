import "server-only";

import type { Role } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { issueInviteToken } from "@/lib/data/auth";
import { invalidateAllSessionsForUser } from "@/lib/data/sessions";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";

/**
 * Parent and teacher accounts.
 *
 * Owner-only throughout. Account creation is the act that grants a person access
 * to photographs of children, so it does not get delegated to teachers.
 *
 * There is no self-registration anywhere in this system. Every account starts as
 * INVITED with no password and becomes ACTIVE only when the invitee follows a
 * single-use, expiring link.
 */

export type PersonListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: "INVITED" | "ACTIVE" | "DISABLED";
  lastLoginAt: Date | null;
  createdAt: Date;
  children: Array<{ id: string; firstName: string; lastName: string }>;
  classes: Array<{ id: string; name: string }>;
};

function requireOwner(session: Session) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();
}

export async function listPeople(
  session: Session,
  options: { role?: Role; search?: string | null } = {},
): Promise<PersonListItem[]> {
  requireOwner(session);

  const search = options.search?.trim();

  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(options.role ? { role: options.role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      guardianships: {
        select: {
          child: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      teacherAssignments: {
        select: { class: { select: { id: true, name: true } } },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    children: row.guardianships.map((g) => g.child),
    classes: row.teacherAssignments.map((t) => t.class),
  }));
}

export type InviteResult = {
  user: { id: string; name: string; email: string; role: Role };
  /** Raw invite token — send it, never store it, never log it. */
  token: string;
  inviteUrl: string;
};

/**
 * Create an account and issue an invitation.
 *
 * Re-inviting an existing INVITED account reissues the token rather than
 * failing, because "I never got the email" is the common case. Re-inviting an
 * ACTIVE account is refused: that would be a password-reset path with no
 * knowledge of the current password.
 */
export async function invitePerson(
  session: Session,
  input: {
    name: string;
    email: string;
    phone?: string;
    role: Extract<Role, "PARENT" | "TEACHER">;
    childIds?: string[];
    classIds?: string[];
  },
  appUrl: string,
): Promise<InviteResult> {
  requireOwner(session);

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, status: true, role: true, deletedAt: true },
  });

  if (existing && !existing.deletedAt && existing.status === "ACTIVE") {
    throw new ForbiddenError(
      "An active account already exists for that email address.",
    );
  }

  const user =
    existing && !existing.deletedAt
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            phone: input.phone ?? null,
            role: input.role,
            status: "INVITED",
          },
          select: { id: true, name: true, email: true, role: true },
        })
      : await prisma.user.create({
          data: {
            email: input.email,
            name: input.name,
            phone: input.phone ?? null,
            role: input.role,
            status: "INVITED",
          },
          select: { id: true, name: true, email: true, role: true },
        });

  if (input.role === "PARENT" && input.childIds?.length) {
    await prisma.guardianship.createMany({
      data: input.childIds.map((childId) => ({
        parentUserId: user.id,
        childId,
        relationship: "GUARDIAN" as const,
      })),
      skipDuplicates: true,
    });
  }

  if (input.role === "TEACHER" && input.classIds?.length) {
    await prisma.teacherAssignment.createMany({
      data: input.classIds.map((classId) => ({ userId: user.id, classId })),
      skipDuplicates: true,
    });
  }

  const token = await issueInviteToken(user.id);

  return {
    user,
    token,
    inviteUrl: `${appUrl}/invite?token=${token}`,
  };
}

export async function reissueInvite(
  session: Session,
  userId: string,
  appUrl: string,
): Promise<InviteResult> {
  requireOwner(session);

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!user) throw new NotFoundError();
  if (user.status === "ACTIVE") {
    throw new ForbiddenError(
      "That account is already active. Ask them to use the password reset link instead.",
    );
  }

  const token = await issueInviteToken(user.id);
  return { user, token, inviteUrl: `${appUrl}/invite?token=${token}` };
}

/**
 * Disable an account and evict it immediately.
 *
 * Dropping the sessions is the point: a teacher who has left should lose access
 * the moment the owner clicks this, not whenever their cookie happens to expire.
 */
export async function disablePerson(session: Session, userId: string) {
  requireOwner(session);

  if (userId === session.user.id) {
    throw new ForbiddenError("You cannot disable your own account.");
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new NotFoundError();

  await prisma.user.update({
    where: { id: userId },
    data: { status: "DISABLED" },
  });

  const revoked = await invalidateAllSessionsForUser(userId);

  return { user, revokedSessions: revoked };
}

export async function enablePerson(session: Session, userId: string) {
  requireOwner(session);

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
    },
  });
  if (!user) throw new NotFoundError();

  await prisma.user.update({
    where: { id: userId },
    data: {
      // A person who never set a password returns to INVITED, not ACTIVE —
      // otherwise they would be "active" with no way to sign in.
      status: user.passwordHash ? "ACTIVE" : "INVITED",
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  return { user };
}

/** Parent accounts available to link to a child, for the picker UI. */
export async function listParentsForPicker(session: Session) {
  requireOwner(session);

  return prisma.user.findMany({
    where: { role: "PARENT", deletedAt: null, status: { not: "DISABLED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}
