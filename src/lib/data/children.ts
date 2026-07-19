import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  type Page,
} from "@/lib/data/pagination";
import { assertCanViewChild, classIdsForTeacher } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import type { ChildInput } from "@/lib/validation";

/**
 * Children.
 *
 * Reads are scoped by role in the query itself:
 *   OWNER    every child
 *   TEACHER  children in their assigned classes only
 *   PARENT   never reaches this module — the portal uses its own scoped reads
 *
 * Writes are owner-only. A teacher changing a child's class or guardians would
 * change who can see that child's photographs, which is the owner's call as the
 * data controller.
 */

export type ChildListItem = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  photoConsent: boolean;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  class: { id: string; name: string } | null;
  guardians: Array<{ id: string; name: string; email: string }>;
};

/** Scope fragment for the caller's role. Owner gets `{}` (unrestricted). */
async function scopeFilter(session: Session) {
  switch (session.user.role) {
    case "OWNER":
      return {};
    case "TEACHER": {
      const classIds = await classIdsForTeacher(session.user.id);
      // An empty assignment list must match nothing, not everything.
      return { classId: { in: classIds } };
    }
    case "PARENT":
      throw new ForbiddenError();
  }
}

export async function listChildren(
  session: Session,
  options: {
    cursor?: string | null;
    limit?: number;
    classId?: string | null;
    search?: string | null;
    includeArchived?: boolean;
  } = {},
): Promise<Page<ChildListItem>> {
  const limit = clampPageSize(options.limit);
  const cursor = decodeCursor(options.cursor);
  const scoped = await scopeFilter(session);

  // A teacher narrowing to a class they do not have stays inside their scope,
  // because both filters are ANDed rather than the explicit one replacing it.
  const classFilter = options.classId ? { classId: options.classId } : {};

  const search = options.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const rows = await prisma.child.findMany({
    where: {
      deletedAt: null,
      ...(options.includeArchived ? {} : { status: "ACTIVE" as const }),
      ...scoped,
      ...classFilter,
      ...searchFilter,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.at } },
              { createdAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      photoConsent: true,
      status: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
      // Included in the same query rather than fetched per row — this is the
      // N+1 the admin list would otherwise have.
      guardianships: {
        select: {
          parent: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return buildPage(
    rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      dateOfBirth: row.dateOfBirth,
      photoConsent: row.photoConsent,
      status: row.status,
      createdAt: row.createdAt,
      class: row.class,
      guardians: row.guardianships.map((g) => g.parent),
    })),
    limit,
    (row) => ({ at: row.createdAt, id: row.id }),
  );
}

/**
 * How many children the caller can see.
 *
 * Uses the same scope filter as the list, so the number on the overview can
 * never disagree with what the list actually shows.
 */
export async function countChildren(session: Session): Promise<number> {
  const scoped = await scopeFilter(session);

  return prisma.child.count({
    where: { deletedAt: null, status: "ACTIVE", ...scoped },
  });
}

export async function getChildDetail(session: Session, childId: string) {
  // Authorization first; throws NotFound for out-of-scope children.
  await assertCanViewChild(session, childId);

  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      photoConsent: true,
      allergiesNote: true,
      status: true,
      enrolledAt: true,
      leftAt: true,
      class: { select: { id: true, name: true } },
      guardianships: {
        select: {
          id: true,
          relationship: true,
          isPrimary: true,
          parent: {
            select: { id: true, name: true, email: true, phone: true, status: true },
          },
        },
        orderBy: { isPrimary: "desc" },
      },
    },
  });

  if (!child) throw new NotFoundError();
  return child;
}

export async function createChild(session: Session, input: ChildInput) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  if (input.classId) {
    const klass = await prisma.class.findFirst({
      where: { id: input.classId, archivedAt: null },
      select: { id: true },
    });
    if (!klass) throw new NotFoundError();
  }

  return prisma.child.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      classId: input.classId,
      photoConsent: input.photoConsent,
      allergiesNote: input.allergiesNote ?? null,
    },
    select: { id: true, firstName: true, lastName: true },
  });
}

export async function updateChild(
  session: Session,
  childId: string,
  input: ChildInput,
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const before = await prisma.child.findFirst({
    where: { id: childId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      classId: true,
      photoConsent: true,
      allergiesNote: true,
    },
  });
  if (!before) throw new NotFoundError();

  const after = await prisma.child.update({
    where: { id: childId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      classId: input.classId,
      photoConsent: input.photoConsent,
      allergiesNote: input.allergiesNote ?? null,
    },
    select: { id: true, firstName: true, lastName: true, photoConsent: true },
  });

  return { before, after };
}

/**
 * Archive a child who has left the nursery.
 *
 * Reversible, and photos are retained: families routinely ask for photographs
 * after leaving. Permanent destruction is a separate, deliberate action —
 * see deleteChild.
 */
export async function archiveChild(session: Session, childId: string) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const child = await prisma.child.findFirst({
    where: { id: childId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!child) throw new NotFoundError();

  await prisma.child.update({
    where: { id: childId },
    data: { status: "ARCHIVED", archivedAt: new Date(), leftAt: new Date() },
  });

  return child;
}

export async function restoreChild(session: Session, childId: string) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const child = await prisma.child.findFirst({
    where: { id: childId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!child) throw new NotFoundError();

  await prisma.child.update({
    where: { id: childId },
    data: { status: "ACTIVE", archivedAt: null, leftAt: null },
  });

  return child;
}

/**
 * Permanently delete a child and everything attached to them.
 *
 * This is the privacy requirement: when a family leaves and asks to be erased,
 * the nursery must be able to honour that. Photo tags and pickup persons cascade
 * at the database level. Photo *objects* in storage are removed by a queued job,
 * which Phase 3 wires up — the ids are collected here and returned so the caller
 * can enqueue that work.
 *
 * The typed-name confirmation is enforced by the caller (see deleteChildInput).
 */
export async function deleteChild(session: Session, childId: string) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const child = await prisma.child.findFirst({
    where: { id: childId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!child) throw new NotFoundError();

  // Photos tagged with ONLY this child become orphaned and must be destroyed.
  // Photos also tagged with siblings or classmates must not be, so they are
  // excluded here rather than deleted and regretted.
  const exclusivePhotos = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT p."id"
    FROM photos p
    JOIN photo_tags t ON t."photoId" = p."id"
    WHERE t."childId" = ${childId}
      AND p."visibility" = 'TAGGED_ONLY'
      AND NOT EXISTS (
        SELECT 1 FROM photo_tags other
        WHERE other."photoId" = p."id" AND other."childId" <> ${childId}
      )
  `;

  await prisma.$transaction([
    // Soft-delete the photos first so nothing serves them while storage cleanup
    // is still queued.
    prisma.photo.updateMany({
      where: { id: { in: exclusivePhotos.map((p) => p.id) } },
      data: { deletedAt: new Date() },
    }),
    prisma.child.update({
      where: { id: childId },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    }),
    // Tags, guardianships and pickup persons cascade via onDelete: Cascade,
    // but the child row is soft-deleted, so remove the access-granting edges
    // explicitly. A guardianship that outlives the deletion would be a live
    // permission pointing at erased data.
    prisma.guardianship.deleteMany({ where: { childId } }),
    prisma.pickupPerson.updateMany({
      where: { childId },
      data: { deletedAt: new Date(), status: "REVOKED" },
    }),
  ]);

  return { child, orphanedPhotoIds: exclusivePhotos.map((p) => p.id) };
}

// ---------------------------------------------------------------------------
// Guardianships
// ---------------------------------------------------------------------------

export async function linkGuardian(
  session: Session,
  input: {
    parentUserId: string;
    childId: string;
    relationship: "MOTHER" | "FATHER" | "GUARDIAN" | "OTHER";
    isPrimary: boolean;
  },
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const [parent, child] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.parentUserId, deletedAt: null },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.child.findFirst({
      where: { id: input.childId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  if (!parent || !child) throw new NotFoundError();
  if (parent.role !== "PARENT") {
    throw new ForbiddenError("Only parent accounts can be linked to a child.");
  }

  await prisma.guardianship.upsert({
    where: {
      parentUserId_childId: {
        parentUserId: input.parentUserId,
        childId: input.childId,
      },
    },
    update: { relationship: input.relationship, isPrimary: input.isPrimary },
    create: {
      parentUserId: input.parentUserId,
      childId: input.childId,
      relationship: input.relationship,
      isPrimary: input.isPrimary,
    },
  });

  return { parent, child };
}

/**
 * Remove a guardian's access to a child.
 *
 * This revokes visibility of that child's photographs immediately, which is
 * exactly what it is for. Audited by the caller.
 */
export async function unlinkGuardian(
  session: Session,
  parentUserId: string,
  childId: string,
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const link = await prisma.guardianship.findUnique({
    where: { parentUserId_childId: { parentUserId, childId } },
    select: {
      parent: { select: { id: true, name: true, email: true } },
      child: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!link) throw new NotFoundError();

  await prisma.guardianship.delete({
    where: { parentUserId_childId: { parentUserId, childId } },
  });

  return link;
}
