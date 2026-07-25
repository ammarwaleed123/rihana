import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  olderThan,
  pageOffset,
  publishedBefore,
  type NumberedPage,
  type Page,
} from "@/lib/data/pagination";
import {
  filterForParent,
  parentScopeForChild,
  photoListSelect,
  toPhotoListItem,
  PARENT_PHOTOS_PER_PAGE,
  type PhotoListItem,
} from "@/lib/data/photos";
import { childIdsForParent, classIdsForTeacher } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import type { AlbumInput } from "@/lib/validation";

/**
 * Albums — named groupings like "Graduation Day 2026".
 *
 * THE RULE THAT MATTERS: an album never widens access.
 *
 * Putting a photo in an album does not share it. A parent sees an album as the
 * subset of its photos they were *already* entitled to under the routing rule,
 * and an album that resolves to nothing for them does not appear at all — not
 * as an empty album, not as a title, not as a count. The temptation with a
 * feature like this is to treat membership as permission, because that is what
 * a shared photo album normally means. Here it would hand every family a
 * gallery of other people's children.
 *
 * Every parent-facing query below therefore composes `filterForParent` — the
 * same function the photo pages use. It is imported rather than restated: two
 * expressions of one access rule is one too many, and the second is always the
 * one that gets forgotten when the first is corrected.
 */

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * Assert the caller may manage this album, and return it.
 *
 * A class album belongs to the owner and to the teachers assigned to that
 * class. A nursery-wide album (`classId === null`) is owner-only: it can hold
 * photos from any class, so managing one means reaching across every class in
 * the nursery, which is not a teacher's remit.
 */
async function assertCanManageAlbum(session: Session, albumId: string) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  const album = await prisma.album.findFirst({
    where: { id: albumId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      classId: true,
      coverPhotoId: true,
      eventDate: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
    },
  });

  if (!album) throw new NotFoundError();
  if (session.user.role === "OWNER") return album;

  const classIds = await classIdsForTeacher(session.user.id);
  if (!album.classId || !classIds.includes(album.classId)) {
    throw new NotFoundError();
  }

  return album;
}

/**
 * Which photos this staff member may put in an album.
 *
 * Owners reach everything; teachers reach their assigned classes only. Photos
 * still being processed or quarantined are excluded — an album is a curated
 * thing, and a broken tile in one is worse than a missing one.
 */
async function staffPhotoScope(session: Session) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  const base = { deletedAt: null, status: "READY" as const };

  if (session.user.role === "OWNER") return base;

  const classIds = await classIdsForTeacher(session.user.id);
  return { ...base, classId: { in: classIds } };
}

// ---------------------------------------------------------------------------
// Parent-facing reads
// ---------------------------------------------------------------------------

export type ParentAlbumSummary = {
  id: string;
  title: string;
  description: string | null;
  eventDate: Date | null;
  publishedAt: Date | null;
  className: string | null;
  /** Photos in this album that THIS parent may see. Never the album's total. */
  photoCount: number;
  /** A cover this parent may see, or null. Never leaks an unseeable photo. */
  coverPhotoId: string | null;
};

/**
 * Albums visible to a parent, newest published first.
 *
 * `photos: { some: { photo: filter } }` is the whole security story: an album
 * is listed only if it contains at least one photo this family may already
 * see. It compiles to an EXISTS subquery, so it also paginates honestly —
 * filtering empty albums out *after* fetching a page would produce short pages
 * and, worse, pages that are entirely blank while still claiming there is more.
 */
export async function listAlbumsForParent(
  session: Session,
  options: { cursor?: string | null; limit?: number; childId?: string } = {},
): Promise<Page<ParentAlbumSummary>> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const limit = clampPageSize(options.limit ?? 12);
  const cursor = decodeCursor(options.cursor);
  // Narrowed to one child when asked. `photos: { some: { photo: filter } }`
  // then lists only albums holding a photo THAT child may see, and the count
  // and cover follow the same filter — an album with nothing for the chosen
  // child simply does not appear under their name.
  const filter = await parentScopeForChild(session, options.childId);

  const rows = await prisma.album.findMany({
    where: {
      AND: [
        {
          status: "PUBLISHED" as const,
          publishedAt: { not: null },
          deletedAt: null,
          photos: { some: { photo: filter } },
        },
        ...publishedBefore(cursor),
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      title: true,
      description: true,
      eventDate: true,
      publishedAt: true,
      coverPhotoId: true,
      class: { select: { name: true } },
      // Counted through the same filter, so the number on the card matches what
      // opening it actually shows. An album's true size is not this family's
      // business — it would say how many photos of other children it holds.
      _count: { select: { photos: { where: { photo: filter } } } },
      // Fallback cover, resolved in the same round trip.
      photos: {
        where: { photo: filter },
        orderBy: [{ sortOrder: "asc" }, { photoId: "asc" }],
        take: 1,
        select: { photoId: true },
      },
    },
  });

  /*
   * The chosen cover may be a photo this family cannot see — a picture of
   * another child is a perfectly reasonable cover for the nursery's own album.
   * Resolve which covers are visible in ONE query for the whole page rather
   * than per row, then fall back to the album's first visible photo.
   */
  const coverIds = rows
    .map((row) => row.coverPhotoId)
    .filter((id): id is string => id !== null);

  const visibleCoverIds = new Set(
    coverIds.length === 0
      ? []
      : (
          await prisma.photo.findMany({
            where: { AND: [filter, { id: { in: coverIds } }] },
            select: { id: true },
          })
        ).map((photo) => photo.id),
  );

  return buildPage(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      eventDate: row.eventDate,
      publishedAt: row.publishedAt,
      className: row.class?.name ?? null,
      photoCount: row._count.photos,
      coverPhotoId:
        row.coverPhotoId && visibleCoverIds.has(row.coverPhotoId)
          ? row.coverPhotoId
          : (row.photos[0]?.photoId ?? null),
    })),
    limit,
    // publishedAt is non-null here: the query requires it.
    (row) => ({ at: row.publishedAt!, id: row.id }),
  );
}

export const PARENT_ALBUMS_PER_PAGE = 8;

/**
 * Albums visible to a parent, in numbered pages — the same interface the photo
 * list uses, so a family can jump to "page 3 of 7" rather than tapping "load
 * more" repeatedly. Offset is safe here for the same reason as the album detail:
 * the set is one family's own albums, a handful, never the whole nursery's.
 *
 * The security story is identical to `listAlbumsForParent` — an album appears
 * only if it holds a photo this family may already see, and the count and cover
 * follow that same filter.
 */
export async function getAlbumsPageForParent(
  session: Session,
  options: { page?: number; pageSize?: number; childId?: string } = {},
): Promise<NumberedPage<ParentAlbumSummary>> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const pageSize = options.pageSize ?? PARENT_ALBUMS_PER_PAGE;
  const filter = await parentScopeForChild(session, options.childId);

  const where = {
    status: "PUBLISHED" as const,
    publishedAt: { not: null },
    deletedAt: null,
    photos: { some: { photo: filter } },
  };

  const total = await prisma.album.count({ where });
  const { page, pageCount, skip } = pageOffset(options.page ?? 1, total, pageSize);

  const rows = await prisma.album.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip,
    take: pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      eventDate: true,
      publishedAt: true,
      coverPhotoId: true,
      class: { select: { name: true } },
      _count: { select: { photos: { where: { photo: filter } } } },
      photos: {
        where: { photo: filter },
        orderBy: [{ sortOrder: "asc" }, { photoId: "asc" }],
        take: 1,
        select: { photoId: true },
      },
    },
  });

  // Same cover resolution as the cursor list: the chosen cover may be a photo
  // this family cannot see, so verify it and fall back to their first visible
  // one — never leak an unseeable photo as a cover.
  const coverIds = rows
    .map((row) => row.coverPhotoId)
    .filter((id): id is string => id !== null);

  const visibleCoverIds = new Set(
    coverIds.length === 0
      ? []
      : (
          await prisma.photo.findMany({
            where: { AND: [filter, { id: { in: coverIds } }] },
            select: { id: true },
          })
        ).map((photo) => photo.id),
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      eventDate: row.eventDate,
      publishedAt: row.publishedAt,
      className: row.class?.name ?? null,
      photoCount: row._count.photos,
      coverPhotoId:
        row.coverPhotoId && visibleCoverIds.has(row.coverPhotoId)
          ? row.coverPhotoId
          : (row.photos[0]?.photoId ?? null),
    })),
    page,
    pageCount,
    pageSize,
    total,
  };
}

export type ParentAlbumDetail = {
  album: {
    id: string;
    title: string;
    description: string | null;
    eventDate: Date | null;
    className: string | null;
    photoCount: number;
  };
  photos: NumberedPage<PhotoListItem>;
};

/**
 * One album, as this parent sees it, in numbered pages of six.
 *
 * Returns null for "no such album", "not published" and "contains nothing you
 * may see" alike — the caller turns all three into a 404. Distinguishing them
 * would confirm that an album exists and, by its title, roughly what is in it.
 *
 * Photos are ordered newest-first like every other photo list, not by the
 * album's `sortOrder`. Curated ordering is a staff convenience for choosing a
 * cover; parents scrolling a graduation album expect the same order as the rest
 * of the portal.
 */
export async function getAlbumForParent(
  session: Session,
  albumId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<ParentAlbumDetail | null> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const pageSize = options.pageSize ?? PARENT_PHOTOS_PER_PAGE;
  const filter = await filterForParent(session);
  const myChildIds = await childIdsForParent(session.user.id);

  const album = await prisma.album.findFirst({
    where: {
      id: albumId,
      status: "PUBLISHED",
      publishedAt: { not: null },
      deletedAt: null,
      photos: { some: { photo: filter } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      eventDate: true,
      class: { select: { name: true } },
      // The visible-to-this-family total, which is also the pagination total.
      _count: { select: { photos: { where: { photo: filter } } } },
    },
  });

  if (!album) return null;

  const total = album._count.photos;
  const { page, pageCount, skip } = pageOffset(options.page ?? 1, total, pageSize);

  const rows = await prisma.photo.findMany({
    // The routing rule AND membership of this album. Nothing here widens access;
    // the album only narrows the family's own photos to this collection.
    where: { AND: [filter, { albumPhotos: { some: { albumId } } }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: pageSize,
    select: photoListSelect(myChildIds),
  });

  return {
    album: {
      id: album.id,
      title: album.title,
      description: album.description,
      eventDate: album.eventDate,
      className: album.class?.name ?? null,
      photoCount: total,
    },
    photos: {
      items: rows.map(toPhotoListItem),
      page,
      pageCount,
      pageSize,
      total,
    },
  };
}

// ---------------------------------------------------------------------------
// Staff-facing reads
// ---------------------------------------------------------------------------

/**
 * Albums a staff member sees on the admin list.
 *
 * Owner: everything. Teacher: every PUBLISHED album, of any class, plus their
 * own classes' drafts. Published albums are shared staff-wide — any teacher can
 * open one and view its photos — while a draft belongs to the class that is
 * still preparing it. Editing is a separate question, decided per album by
 * `canManageAlbum`.
 */
export async function listAlbumsForStaff(session: Session, limit = 50) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  const scoped =
    session.user.role === "TEACHER"
      ? {
          OR: [
            { status: "PUBLISHED" as const },
            { classId: { in: await classIdsForTeacher(session.user.id) } },
          ],
        }
      : {};

  return prisma.album.findMany({
    where: { deletedAt: null, ...scoped },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      eventDate: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      coverPhotoId: true,
      class: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { photos: true } },
    },
  });
}

/**
 * Whether this staff member may edit this album.
 *
 * Owner always; a teacher only for a class they are assigned to. A nursery-wide
 * album (no class) is owner-only, because editing it reaches across every class.
 * This is the single source of truth the write actions defer to, and it is what
 * the view/edit split on the detail screen is built from.
 */
async function canManageAlbum(
  session: Session,
  album: { classId: string | null },
): Promise<boolean> {
  if (session.user.role === "OWNER") return true;
  if (session.user.role !== "TEACHER") return false;
  if (!album.classId) return false;
  const classIds = await classIdsForTeacher(session.user.id);
  return classIds.includes(album.classId);
}

/**
 * One album plus its photos, for the staff screen.
 *
 * Any staff member may VIEW a published album; a teacher may also view a draft
 * of their own class. The returned `canManage` flag tells the page whether to
 * render the editing controls — a teacher looking at another class's published
 * album sees it read-only.
 */
export async function getAlbumForStaff(session: Session, albumId: string) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  const album = await prisma.album.findFirst({
    where: { id: albumId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      classId: true,
      coverPhotoId: true,
      eventDate: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
    },
  });

  if (!album) throw new NotFoundError();

  const manage = await canManageAlbum(session, album);

  // A teacher who cannot manage may still view — but only a published album.
  // A draft in another class does not exist as far as they are concerned.
  if (!manage && album.status !== "PUBLISHED") throw new NotFoundError();

  const photos = await prisma.photo.findMany({
    where: { albumPhotos: { some: { albumId } }, deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      caption: true,
      createdAt: true,
      publishedAt: true,
      visibility: true,
      tags: { select: { child: { select: { id: true, firstName: true } } } },
    },
  });

  return {
    ...album,
    canManage: manage,
    photos: photos.map((photo) => ({
      id: photo.id,
      caption: photo.caption,
      createdAt: photo.createdAt,
      publishedAt: photo.publishedAt,
      visibility: photo.visibility,
      taggedChildren: photo.tags.map((tag) => tag.child),
    })),
  };
}

/**
 * Photos this staff member could add to the album, excluding ones already in
 * it. Keyset paginated — a nursery two years in has tens of thousands.
 */
export async function getPhotosAvailableForAlbum(
  session: Session,
  albumId: string,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<Page<{ id: string; caption: string | null; createdAt: Date }>> {
  const album = await assertCanManageAlbum(session, albumId);

  const limit = clampPageSize(options.limit ?? 24);
  const cursor = decodeCursor(options.cursor);
  const scope = await staffPhotoScope(session);
  // The album's class scopes the picker: a Sunflowers album offers only
  // Sunflowers photos — whether a child is tagged or it is a class photo, since
  // both carry that class — so an Olives photo can't be added to it by mistake.
  // A whole-nursery album (no class) offers every class's photos.
  const classFilter = album.classId ? { classId: album.classId } : {};

  const rows = await prisma.photo.findMany({
    where: {
      AND: [
        scope,
        classFilter,
        { albumPhotos: { none: { albumId } } },
        ...olderThan(cursor),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, caption: true, createdAt: true },
  });

  return buildPage(rows, limit, (row) => ({ at: row.createdAt, id: row.id }));
}

// ---------------------------------------------------------------------------
// Staff writes
// ---------------------------------------------------------------------------

export async function createAlbum(session: Session, input: AlbumInput) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  // A teacher may only create an album inside a class they are assigned to.
  // Nursery-wide albums (no class) are the owner's to make.
  if (session.user.role === "TEACHER") {
    const classIds = await classIdsForTeacher(session.user.id);
    if (!input.classId || !classIds.includes(input.classId)) {
      throw new ForbiddenError(
        "You can only create albums for a class you teach.",
      );
    }
  }

  return prisma.album.create({
    data: {
      title: input.title,
      description: input.description || null,
      classId: input.classId || null,
      eventDate: input.eventDate ?? null,
      createdByUserId: session.user.id,
    },
    select: { id: true, title: true },
  });
}

export async function updateAlbum(
  session: Session,
  albumId: string,
  input: AlbumInput,
) {
  const before = await assertCanManageAlbum(session, albumId);

  /*
   * Moving an album between classes is owner-only.
   *
   * A teacher could otherwise create an album in their own class and then
   * reassign it — to another class, or to nursery-wide — which is a way to
   * gain reach they were never granted. The check is on the *destination* as
   * well as the source for exactly that reason.
   */
  const classChanged = (input.classId || null) !== before.classId;
  if (classChanged && session.user.role !== "OWNER") {
    throw new ForbiddenError("Only the owner can move an album to another class.");
  }

  const after = await prisma.album.update({
    where: { id: albumId },
    data: {
      title: input.title,
      description: input.description || null,
      classId: input.classId || null,
      eventDate: input.eventDate ?? null,
    },
    select: { id: true, title: true, classId: true },
  });

  return { before, after };
}

/**
 * Add photos to an album.
 *
 * Each photo is re-checked against the caller's own scope. The ids arrive in a
 * form post, so trusting them would let a teacher add another class's photos
 * by editing the request — the album would then be perfectly correct about who
 * may see what, and completely wrong about what it contains.
 */
export async function addPhotosToAlbum(
  session: Session,
  albumId: string,
  photoIds: string[],
): Promise<{ added: number; skipped: number }> {
  const album = await assertCanManageAlbum(session, albumId);
  if (photoIds.length === 0) return { added: 0, skipped: 0 };

  const scope = await staffPhotoScope(session);
  // Enforce the album's class here too, not just in the picker: the ids arrive
  // in a form post, so a tampered request could otherwise slip a wrong-class
  // photo into a class album. A whole-nursery album (no class) accepts any.
  const classFilter = album.classId ? { classId: album.classId } : {};

  const allowed = await prisma.photo.findMany({
    where: { AND: [scope, classFilter, { id: { in: photoIds } }] },
    select: { id: true },
  });

  if (allowed.length > 0) {
    await prisma.albumPhoto.createMany({
      data: allowed.map((photo, index) => ({
        albumId,
        photoId: photo.id,
        sortOrder: index,
      })),
      // Adding a photo already in the album is a no-op, not an error. Staff
      // multi-select across pages and will re-pick things.
      skipDuplicates: true,
    });
  }

  return {
    added: allowed.length,
    skipped: photoIds.length - allowed.length,
  };
}

export async function removePhotoFromAlbum(
  session: Session,
  albumId: string,
  photoId: string,
) {
  const album = await assertCanManageAlbum(session, albumId);

  await prisma.albumPhoto
    .delete({ where: { albumId_photoId: { albumId, photoId } } })
    .catch(() => {
      // Already gone. Removing something twice is not a failure.
    });

  // A cover that is no longer in the album would render as a broken tile.
  if (album.coverPhotoId === photoId) {
    await prisma.album.update({
      where: { id: albumId },
      data: { coverPhotoId: null },
    });
  }
}

export async function setAlbumCover(
  session: Session,
  albumId: string,
  photoId: string,
) {
  await assertCanManageAlbum(session, albumId);

  const membership = await prisma.albumPhoto.findUnique({
    where: { albumId_photoId: { albumId, photoId } },
    select: { photoId: true },
  });

  if (!membership) throw new NotFoundError();

  await prisma.album.update({
    where: { id: albumId },
    data: { coverPhotoId: photoId },
  });
}

/**
 * Publish an album.
 *
 * Publishing an album does NOT publish its photos, and this is the point where
 * that distinction is easiest to get wrong. A photo becomes visible by being
 * published in its upload session; the album only groups what is already
 * visible. So an album whose photos are all still unpublished is a valid thing
 * to publish — it simply shows up for nobody yet — and the count returned here
 * lets the UI say so instead of implying the album is live for families.
 */
export async function publishAlbum(session: Session, albumId: string) {
  const album = await assertCanManageAlbum(session, albumId);

  const [total, reachable] = await Promise.all([
    prisma.albumPhoto.count({ where: { albumId } }),
    prisma.photo.count({
      where: {
        albumPhotos: { some: { albumId } },
        status: "READY",
        publishedAt: { not: null },
        deletedAt: null,
      },
    }),
  ]);

  if (total === 0) {
    throw new ForbiddenError("Add at least one photo before publishing.");
  }

  const wasPublished = album.status === "PUBLISHED";

  await prisma.album.update({
    where: { id: albumId },
    data: { status: "PUBLISHED", publishedAt: album.publishedAt ?? new Date() },
  });

  // Notify the families who can see the album — only on the transition to
  // published, off the request, deduped on the album id. Skipped when nothing
  // is reachable yet: an album whose photos are all still unpublished would tell
  // nobody, so there is nothing to announce.
  if (!wasPublished && reachable > 0) {
    await enqueue(QUEUES.notifyAlbumPublished, { albumId });
  }

  return { title: album.title, total, reachable };
}

export async function unpublishAlbum(session: Session, albumId: string) {
  const album = await assertCanManageAlbum(session, albumId);

  await prisma.album.update({
    where: { id: albumId },
    // publishedAt is cleared so a republished album sorts by when it was
    // actually shared, not when it was first drafted.
    data: { status: "DRAFT", publishedAt: null },
  });

  return album;
}

/**
 * Delete an album.
 *
 * Soft, and only the grouping — the photos themselves are untouched. An album
 * is a view over photos that exist independently of it, so deleting one must
 * never destroy a family's pictures. Erasing actual photographs is
 * `deleteChild` and `deletePhoto`, which is where that decision belongs.
 */
export async function deleteAlbum(session: Session, albumId: string) {
  const album = await assertCanManageAlbum(session, albumId);

  await prisma.album.update({
    where: { id: albumId },
    data: { deletedAt: new Date(), status: "DRAFT", publishedAt: null },
  });

  return album;
}
