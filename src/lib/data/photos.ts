import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  encodeCursor,
  type Page,
} from "@/lib/data/pagination";
import { parentPhotoFilter } from "@/lib/data/photo-filter";
import {
  childIdsForParent,
  classIdsForParent,
  classIdsForTeacher,
} from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";

/**
 * Photo access. This module is the flagship rule of the whole application.
 *
 * THE ROUTING RULE — a parent's album is exactly:
 *
 *   (a) every photo tagged with one of their own children, plus
 *   (b) every CLASS_ALBUM photo belonging to one of their children's classes.
 *
 * Nothing else. Ever.
 *
 * It is expressed once, in `parentPhotoFilter` below, and every parent-facing
 * read composes that filter rather than restating it. If this rule is wrong,
 * families see photographs of other people's children — so it is written in one
 * place, and the tests in tests/photo-routing.test.ts exercise it directly.
 *
 * Album membership never grants access. An album is a presentation grouping; a
 * parent sees the subset of its photos they were already entitled to, and an
 * album that resolves to nothing for them does not appear at all.
 */

/** Resolve the caller's scope, then build the filter. */
async function filterForParent(session: Session) {
  const [childIds, classIds] = await Promise.all([
    childIdsForParent(session.user.id),
    classIdsForParent(session.user.id),
  ]);

  return parentPhotoFilter(childIds, classIds);
}

export type PhotoListItem = {
  id: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  classId: string | null;
  taggedChildren: Array<{ id: string; firstName: string }>;
};

/**
 * A parent's album, newest first, keyset paginated.
 *
 * `childId` narrows to one child but never widens: the filter is ANDed with the
 * scope, so passing another family's child id yields nothing rather than
 * everything.
 */
export async function getPhotosForParent(
  session: Session,
  options: { cursor?: string | null; limit?: number; childId?: string } = {},
): Promise<Page<PhotoListItem>> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const limit = clampPageSize(options.limit);
  const cursor = decodeCursor(options.cursor);
  const scopeFilter = await filterForParent(session);

  // Narrowing to one child is applied on top of the scope, never instead of it.
  const childNarrow = options.childId
    ? {
        AND: [
          { tags: { some: { childId: options.childId } } },
          // Confirm the child is actually theirs, so a guessed id cannot turn
          // the narrow into a widen.
          {
            tags: {
              some: {
                childId: {
                  in: await childIdsForParent(session.user.id),
                },
              },
            },
          },
        ],
      }
    : {};

  const rows = await prisma.photo.findMany({
    where: {
      ...scopeFilter,
      ...childNarrow,
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
      caption: true,
      width: true,
      height: true,
      createdAt: true,
      classId: true,
      tags: {
        // Only their own children's names, never a classmate's. A class-album
        // photo must not leak who else is in it.
        where: { childId: { in: await childIdsForParent(session.user.id) } },
        select: { child: { select: { id: true, firstName: true } } },
      },
    },
  });

  return buildPage(
    rows.map((row) => ({
      id: row.id,
      caption: row.caption,
      width: row.width,
      height: row.height,
      createdAt: row.createdAt,
      classId: row.classId,
      taggedChildren: row.tags.map((t) => t.child),
    })),
    limit,
    (row) => ({ at: row.createdAt, id: row.id }),
  );
}

/** The caller's own children, for the portal's per-child filter chips. */
export async function getMyChildren(session: Session) {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const childIds = await childIdsForParent(session.user.id);

  return prisma.child.findMany({
    where: { id: { in: childIds } },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true },
  });
}

/**
 * THE GATE in front of every image byte.
 *
 * Returns the photo only if this person may see it, and null otherwise —
 * "missing" and "forbidden" are the same answer, because distinguishing them
 * confirms a photo exists.
 *
 * A signed URL is minted only after this returns non-null. Nothing else in the
 * codebase may generate one.
 */
export async function getPhotoForUser(
  session: Session,
  photoId: string,
): Promise<{
  id: string;
  storageKeyOriginal: string;
  storageKeyWeb: string | null;
  storageKeyThumb: string | null;
} | null> {
  const base = {
    id: true,
    storageKeyOriginal: true,
    storageKeyWeb: true,
    storageKeyThumb: true,
  } as const;

  switch (session.user.role) {
    case "OWNER":
      return prisma.photo.findFirst({
        where: { id: photoId, deletedAt: null },
        select: base,
      });

    case "TEACHER": {
      // Teachers see photos of their assigned classes only, including ones not
      // yet published — they are the people doing the tagging.
      const classIds = await classIdsForTeacher(session.user.id);
      if (classIds.length === 0) return null;

      return prisma.photo.findFirst({
        where: { id: photoId, deletedAt: null, classId: { in: classIds } },
        select: base,
      });
    }

    case "PARENT": {
      const filter = await filterForParent(session);
      return prisma.photo.findFirst({
        where: { ...filter, id: photoId },
        select: base,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Staff-side reads
// ---------------------------------------------------------------------------

export type AdminPhotoItem = PhotoListItem & {
  status: string;
  visibility: string;
  publishedAt: Date | null;
  tagCount: number;
};

/** Photos in an upload session, for the tagging screen. */
export async function getUploadSessionPhotos(
  session: Session,
  uploadSessionId: string,
): Promise<AdminPhotoItem[]> {
  const uploadSession = await prisma.uploadSession.findUnique({
    where: { id: uploadSessionId },
    select: { id: true, classId: true, uploaderUserId: true },
  });

  if (!uploadSession) throw new NotFoundError();

  if (session.user.role === "TEACHER") {
    const classIds = await classIdsForTeacher(session.user.id);
    if (!uploadSession.classId || !classIds.includes(uploadSession.classId)) {
      throw new NotFoundError();
    }
  } else if (session.user.role !== "OWNER") {
    throw new ForbiddenError();
  }

  const rows = await prisma.photo.findMany({
    where: { uploadSessionId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      caption: true,
      width: true,
      height: true,
      createdAt: true,
      classId: true,
      status: true,
      visibility: true,
      publishedAt: true,
      tags: { select: { child: { select: { id: true, firstName: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    caption: row.caption,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
    classId: row.classId,
    status: row.status,
    visibility: row.visibility,
    publishedAt: row.publishedAt,
    taggedChildren: row.tags.map((t) => t.child),
    tagCount: row.tags.length,
  }));
}

/** Recent upload sessions for the staff photo screen. */
export async function listUploadSessions(session: Session, limit = 20) {
  const scoped =
    session.user.role === "TEACHER"
      ? { classId: { in: await classIdsForTeacher(session.user.id) } }
      : {};

  if (session.user.role === "PARENT") throw new ForbiddenError();

  return prisma.uploadSession.findMany({
    where: scoped,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      photoCount: true,
      publishedAt: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
      uploader: { select: { name: true } },
      _count: { select: { photos: true } },
    },
  });
}

// Re-exported so callers have one import surface for photo access.
export { parentPhotoFilter };
export { encodeCursor };
