import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { signatureKeysForChild } from "@/lib/data/accident-reports";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  olderThan,
  type Page,
} from "@/lib/data/pagination";
import { assertCanViewChild, classIdsForTeacher } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { resyncPhotosForChild } from "@/lib/data/uploads";
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
    // ANDed rather than spread: `searchFilter` and the cursor are both `OR`,
    // and merging them into one object dropped the search on every page after
    // the first. See the note on `olderThan`.
    where: {
      AND: [
        {
          deletedAt: null,
          ...(options.includeArchived ? {} : { status: "ACTIVE" as const }),
          ...scoped,
          ...classFilter,
        },
        searchFilter,
        ...olderThan(cursor),
      ],
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

  /*
   * Photo consent is retroactive AND reversible.
   *
   * Withdrawing it hides the child's photos immediately: a photo tagged only
   * with this child stops being visible to anyone, including their own family,
   * because the nursery has been told to stop sharing this child's image.
   * Restoring it brings those same photos back.
   *
   * The reversibility is the point, and it is why the tags are KEPT rather than
   * deleted. Consent is now a factor in whether a photo is published (see
   * `syncPublicationState`), so flipping the flag and re-deriving publication is
   * all it takes — in both directions. An earlier version deleted the tags on
   * withdrawal, which made restoration impossible: the record of which photos
   * the child appeared in was gone.
   */
  let photosHidden = 0;
  let photosRestored = 0;

  if (before.photoConsent !== input.photoConsent) {
    const result = await resyncPhotosForChild(childId);
    photosHidden = result.unpublished;
    photosRestored = result.published;
  }

  return { before, after, photosHidden, photosRestored };
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
 * Erase a child and everything attached to them. Irreversible.
 *
 * This is the privacy requirement: when a family asks to be erased, the nursery
 * must be able to honour that, and "honour" means the row is gone — not flagged.
 * An earlier version soft-deleted, which left the child's name and date of birth
 * sitting in the table after the owner had been told the record was permanently
 * deleted. That is the wrong answer to an erasure request and the wrong thing to
 * tell the person making it.
 *
 * What survives, deliberately:
 *   - The audit row recording that the erasure happened. Its `childId` becomes
 *     null via ON DELETE SET NULL, so it is a record of the act rather than a
 *     back-door copy of the data.
 *   - Photos that also show other children. Destroying those would erase another
 *     family's record too, which nobody asked for.
 *
 * Storage objects for the orphaned photos, and for the child's pickup people,
 * are removed by a queued job. Their KEYS are returned — not their ids — because
 * the rows that map one to the other are gone by the time this returns.
 */
export async function deleteChild(session: Session, childId: string) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const child = await prisma.child.findFirst({
    where: { id: childId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!child) throw new NotFoundError();

  // Photos showing ONLY this child are orphaned by the deletion and must go.
  // Photos also tagged with siblings or classmates are excluded here rather
  // than deleted and regretted.
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

  const orphanedPhotoIds = exclusivePhotos.map((p) => p.id);

  /*
   * Collect the storage keys BEFORE the transaction removes the rows that hold
   * them. This ordering is the whole difficulty: once the photo and pickup rows
   * are gone there is nothing left to resolve an id back to an object, so a
   * caller handed only ids cannot purge anything. That is exactly what happened
   * — deletion returned ids, the caller logged "storage purge pending queue
   * wiring", and every erased child's images stayed in the bucket while the
   * audit log recorded them as permanently deleted.
   *
   * Both kinds of object belong to the child and both must go: the photos that
   * showed only them, and the avatars of the people authorized to collect them.
   */
  const [orphanedPhotos, pickupPersons, signatureKeys] = await Promise.all([
    prisma.photo.findMany({
      where: { id: { in: orphanedPhotoIds } },
      select: {
        storageKeyOriginal: true,
        storageKeyWeb: true,
        storageKeyThumb: true,
      },
    }),
    prisma.pickupPerson.findMany({
      where: { childId },
      select: { photoStorageKey: true, photoThumbKey: true },
    }),
    /*
     * Signatures on this child's accident records — the teacher's and every
     * guardian's. Exactly the same trap as the photographs: the rows cascade
     * away with the child, and without collecting the keys first the drawn
     * signatures of named people would stay in the bucket after the family was
     * told the record was permanently deleted.
     */
    signatureKeysForChild(childId),
  ]);

  const orphanedKeys = [
    ...orphanedPhotos.flatMap((p) => [
      p.storageKeyOriginal,
      p.storageKeyWeb,
      p.storageKeyThumb,
    ]),
    ...pickupPersons.flatMap((p) => [p.photoStorageKey, p.photoThumbKey]),
    ...signatureKeys,
  ].filter((key): key is string => Boolean(key));

  await prisma.$transaction([
    // Album membership first — AlbumPhoto has no cascade from Photo's side we
    // want to rely on implicitly.
    prisma.albumPhoto.deleteMany({ where: { photoId: { in: orphanedPhotoIds } } }),
    prisma.photoTag.deleteMany({ where: { photoId: { in: orphanedPhotoIds } } }),
    // `coverPhotoId` is a plain column, not a foreign key, so nothing clears it
    // for us — an erased child's photo could stay named as an album's cover.
    prisma.album.updateMany({
      where: { coverPhotoId: { in: orphanedPhotoIds } },
      data: { coverPhotoId: null },
    }),
    prisma.photo.deleteMany({ where: { id: { in: orphanedPhotoIds } } }),

    // Explicit rather than leaning on cascades, so the intent is readable and a
    // future schema change cannot quietly start leaving rows behind.
    prisma.photoTag.deleteMany({ where: { childId } }),
    prisma.guardianship.deleteMany({ where: { childId } }),
    prisma.pickupPerson.deleteMany({ where: { childId } }),
    // Both report kinds take their incidents, meals, toilet lines and
    // acknowledgements with them through their own cascades.
    prisma.dailyReport.deleteMany({ where: { childId } }),
    prisma.accidentReport.deleteMany({ where: { childId } }),

    prisma.child.delete({ where: { id: childId } }),
  ]);

  return { child, orphanedPhotoIds, orphanedKeys };
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
