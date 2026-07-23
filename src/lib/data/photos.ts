import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  encodeCursor,
  olderThan,
  pageOffset,
  type NumberedPage,
  type Page,
} from "@/lib/data/pagination";
import {
  childPhotoFilter,
  parentPhotoFilter,
  type ParentPhotoFilter,
} from "@/lib/data/photo-filter";
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

/**
 * Resolve the caller's scope, then build the filter.
 *
 * Exported because albums need the identical rule. An album is a presentation
 * grouping and must never widen access, so it composes *this* filter rather
 * than describing "which photos may this parent see" a second time — two
 * statements of the same rule is one statement too many.
 */
export async function filterForParent(
  session: Session,
): Promise<ParentPhotoFilter> {
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

/** How many photos a parent sees per page. Parents asked for six. */
export const PARENT_PHOTOS_PER_PAGE = 6;

/**
 * The select used for every parent-facing photo list, and the mapper that turns
 * a row into a `PhotoListItem`. One definition so the tag filter — "only this
 * family's own children's names" — is stated once. A class-album photo must
 * never leak who else is in it, and the way that guarantee gets lost is someone
 * copying the select and dropping the `where`.
 */
export function photoListSelect(myChildIds: string[]) {
  return {
    id: true,
    caption: true,
    width: true,
    height: true,
    createdAt: true,
    classId: true,
    tags: {
      where: { childId: { in: myChildIds } },
      select: { child: { select: { id: true, firstName: true } } },
    },
  } as const;
}

type PhotoListRow = {
  id: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  classId: string | null;
  tags: Array<{ child: { id: string; firstName: string } }>;
};

export function toPhotoListItem(row: PhotoListRow): PhotoListItem {
  return {
    id: row.id,
    caption: row.caption,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
    classId: row.classId,
    taggedChildren: row.tags.map((tag) => tag.child),
  };
}

/**
 * Resolve the scope filter for a parent, optionally narrowed to one child.
 *
 * Narrowing is resolved from the caller's own guardianships, never from the
 * request: an id they do not guard yields the unnarrowed scope rather than
 * someone else's child. The narrow includes that child's class albums, because
 * a photo of the whole class is a photo of that child too — omitting them made
 * class albums vanish the moment a parent tapped a name.
 */
async function resolveParentScope(
  session: Session,
  childId: string | undefined,
  myChildIds: string[],
): Promise<ParentPhotoFilter> {
  if (childId && myChildIds.includes(childId)) {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, classId: true },
    });
    if (child) return childPhotoFilter(child.id, child.classId);
  }
  return filterForParent(session);
}

/**
 * The parent's photo filter, optionally narrowed to one of their own children.
 *
 * Exported for the albums module, which narrows an album list to one child the
 * same way — always resolving the child from the caller's own guardianships,
 * never from the request.
 */
export async function parentScopeForChild(
  session: Session,
  childId?: string,
): Promise<ParentPhotoFilter> {
  const myChildIds = await childIdsForParent(session.user.id);
  return resolveParentScope(session, childId, myChildIds);
}

/**
 * A parent's album, newest first, keyset paginated.
 *
 * Still used where a running "load more" is wanted (the dashboard's latest
 * strip). The main photos page uses `getPhotosPageForParent` for numbered pages.
 */
export async function getPhotosForParent(
  session: Session,
  options: { cursor?: string | null; limit?: number; childId?: string } = {},
): Promise<Page<PhotoListItem>> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const limit = clampPageSize(options.limit);
  const cursor = decodeCursor(options.cursor);
  const myChildIds = await childIdsForParent(session.user.id);
  const scopeFilter = await resolveParentScope(session, options.childId, myChildIds);

  const rows = await prisma.photo.findMany({
    // ANDed, never spread: both the routing rule and the cursor are `OR`, and
    // merging them into one object dropped the rule and leaked every photo from
    // page 2 on. See the note on `olderThan`.
    where: { AND: [scopeFilter, ...olderThan(cursor)] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: photoListSelect(myChildIds),
  });

  return buildPage(rows.map(toPhotoListItem), limit, (row) => ({
    at: row.createdAt,
    id: row.id,
  }));
}

/**
 * A parent's album as numbered pages — "page 3 of 12", six photos a page.
 *
 * Offset rather than keyset, on purpose and only here: parents asked for page
 * numbers and prev/next, which keyset cannot express. The set is one family's
 * own photos, so the offset walks tens of rows, not the nursery's tens of
 * thousands. See `NumberedPage` for the full reasoning.
 */
export async function getPhotosPageForParent(
  session: Session,
  options: { page?: number; childId?: string; pageSize?: number } = {},
): Promise<NumberedPage<PhotoListItem>> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const pageSize = options.pageSize ?? PARENT_PHOTOS_PER_PAGE;
  const myChildIds = await childIdsForParent(session.user.id);
  const scopeFilter = await resolveParentScope(session, options.childId, myChildIds);

  const total = await prisma.photo.count({ where: scopeFilter });
  const { page, pageCount, skip } = pageOffset(options.page ?? 1, total, pageSize);

  const rows = await prisma.photo.findMany({
    where: scopeFilter,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: pageSize,
    select: photoListSelect(myChildIds),
  });

  return { items: rows.map(toPhotoListItem), page, pageCount, pageSize, total };
}

/**
 * One photo, with the details needed to display a page about it.
 *
 * Separate from `getPhotoForUser` — which answers only "may you have these
 * bytes" — because this returns captions and names, and the two questions
 * deserve to stay separately auditable. Both compose the same filter.
 */
export async function getPhotoDetailForParent(
  session: Session,
  photoId: string,
): Promise<PhotoListItem | null> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const filter = await filterForParent(session);
  const myChildIds = await childIdsForParent(session.user.id);

  const row = await prisma.photo.findFirst({
    where: { AND: [filter, { id: photoId }] },
    select: photoListSelect(myChildIds),
  });

  return row ? toPhotoListItem(row) : null;
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
      /*
       * A teacher sees two kinds of photo:
       *
       *   1. Photos of their own assigned classes — including unpublished ones,
       *      because they are the people tagging and publishing them.
       *   2. Any photo that sits in a PUBLISHED album, whatever class it belongs
       *      to. Published albums are shared staff-wide: every teacher can view
       *      one and the pictures in it, even across classes. Editing the album
       *      stays restricted to the assigned teacher — that is enforced on the
       *      write path, not here. This is what lets the Sunflowers teacher see
       *      the Olives photos an owner grouped into a Sunflowers album, instead
       *      of a wall of broken thumbnails.
       */
      const classIds = await classIdsForTeacher(session.user.id);

      return prisma.photo.findFirst({
        where: {
          id: photoId,
          deletedAt: null,
          OR: [
            { classId: { in: classIds } },
            {
              albumPhotos: {
                some: { album: { status: "PUBLISHED", deletedAt: null } },
              },
            },
          ],
        },
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

/**
 * One upload session by id, for the tagging screen.
 *
 * Fetched directly rather than found within the recent list, because that list
 * now hides empty sessions — so relying on it 404'd the tagging page the moment
 * you deleted the last photo. Auth-scoped like everything else: a teacher only
 * reaches a session for a class they teach.
 */
export async function getUploadSession(session: Session, uploadSessionId: string) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  const uploadSession = await prisma.uploadSession.findUnique({
    where: { id: uploadSessionId },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
    },
  });

  if (!uploadSession) throw new NotFoundError();

  if (session.user.role === "TEACHER") {
    const classIds = await classIdsForTeacher(session.user.id);
    if (!uploadSession.class || !classIds.includes(uploadSession.class.id)) {
      throw new NotFoundError();
    }
  }

  return uploadSession;
}

/** Recent upload sessions for the staff photo screen. */
export async function listUploadSessions(session: Session, limit = 20) {
  const scoped =
    session.user.role === "TEACHER"
      ? { classId: { in: await classIdsForTeacher(session.user.id) } }
      : {};

  if (session.user.role === "PARENT") throw new ForbiddenError();

  return prisma.uploadSession.findMany({
    where: {
      ...scoped,
      // Only sessions that actually hold a photo. An empty session — one whose
      // upload was abandoned before any file landed, or whose photos were all
      // deleted — is noise on this screen: there is nothing to tag, publish or
      // view. It stays in the table (it may be mid-upload), it just does not
      // clutter the list.
      photos: { some: {} },
    },
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
export { parentPhotoFilter, childPhotoFilter };
export { encodeCursor };
