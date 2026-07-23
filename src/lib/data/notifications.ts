import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  olderThan,
  type Page,
} from "@/lib/data/pagination";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";

/**
 * Notifications.
 *
 * One table, one mechanism, every channel. "New photos", "new announcement" and
 * later pickup updates all become a `Notification` row here; the in-app bell
 * reads them, and when push arrives (Phase 8) the same rows drive it. The
 * flagship requirement lives in the fan-out: notify the affected parents ONLY,
 * batched per publish event — one notification per family per child, never one
 * per photo.
 *
 * Idempotency is structural, not check-then-act. Every row carries a
 * `dedupeKey`, and `(userId, dedupeKey)` is unique, so a retried job inserts
 * with `skipDuplicates` and simply no-ops the second time. A fan-out cannot
 * double-notify however many times pg-boss retries it.
 */

// ---------------------------------------------------------------------------
// Fan-out: new photos
// ---------------------------------------------------------------------------

type NotificationRow = {
  userId: string;
  type: "NEW_PHOTOS" | "NEW_ANNOUNCEMENT";
  title: string;
  body: string;
  payload: Prisma.InputJsonValue;
  linkPath: string;
  dedupeKey: string;
};

/**
 * Notify the families reached by a freshly-published upload.
 *
 * Runs in the worker, off the publish request. Two kinds of photo need two kinds
 * of notification, because they reach families two different ways:
 *
 *  - A **tagged** photo (TAGGED_ONLY) is *of* specific children, and it is
 *    consent-gated — a child without consent has no visible tagged photos. So
 *    the notification is per child: "3 new photos of Laila", counting only
 *    consenting tags.
 *  - A **class-album** photo is class-level sharing. It is visible to every
 *    family in the class *regardless of any one child's consent* — which is
 *    exactly why a family must be notified even when their own child's consent
 *    is withdrawn, or the photo would appear with no notification (the very
 *    inconsistency this fixes). So the notification is per class, addressed to
 *    all guardians of the class, and named for the class, not a child.
 *
 * Idempotent: every row's `(userId, dedupeKey)` is unique, so a retry no-ops.
 */
export async function fanOutPhotosPublished(
  uploadSessionId: string,
): Promise<{ created: number }> {
  const photos = await prisma.photo.findMany({
    where: {
      uploadSessionId,
      status: "READY",
      publishedAt: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      visibility: true,
      classId: true,
      // Consenting tags only — matches what a TAGGED_ONLY photo makes visible.
      tags: { where: { child: { photoConsent: true } }, select: { childId: true } },
    },
  });

  if (photos.length === 0) return { created: 0 };

  const countByChild = new Map<string, number>(); // tagged photos, per child
  const countByClass = new Map<string, number>(); // class-album photos, per class

  for (const photo of photos) {
    if (photo.visibility === "CLASS_ALBUM" && photo.classId) {
      countByClass.set(
        photo.classId,
        (countByClass.get(photo.classId) ?? 0) + 1,
      );
    } else {
      for (const tag of photo.tags) {
        countByChild.set(tag.childId, (countByChild.get(tag.childId) ?? 0) + 1);
      }
    }
  }

  const rows: NotificationRow[] = [];

  // --- Per child: tagged photos ------------------------------------------
  if (countByChild.size > 0) {
    const childIds = [...countByChild.keys()];
    const [children, guardianships] = await Promise.all([
      prisma.child.findMany({
        where: { id: { in: childIds } },
        select: { id: true, firstName: true },
      }),
      prisma.guardianship.findMany({
        where: { childId: { in: childIds } },
        select: { childId: true, parentUserId: true },
      }),
    ]);
    const nameById = new Map(children.map((c) => [c.id, c.firstName]));

    for (const g of guardianships) {
      const count = countByChild.get(g.childId) ?? 0;
      if (count === 0) continue;
      const name = nameById.get(g.childId) ?? "your child";
      const noun = count === 1 ? "photo" : "photos";
      rows.push({
        userId: g.parentUserId,
        type: "NEW_PHOTOS",
        title: `${count} new ${noun} of ${name}`,
        body: `${count} new ${noun} of ${name} ${count === 1 ? "is" : "are"} ready to see.`,
        payload: { childId: g.childId, uploadSessionId, count },
        linkPath: `/portal/photos?childId=${g.childId}`,
        dedupeKey: `photos:${uploadSessionId}:child:${g.childId}`,
      });
    }
  }

  // --- Per class: class-album photos (NOT consent-gated) -----------------
  if (countByClass.size > 0) {
    const classIds = [...countByClass.keys()];
    const [classes, classChildren] = await Promise.all([
      prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true },
      }),
      // Every active child in the class — class-album visibility does not depend
      // on consent, so neither does the notification about it.
      prisma.child.findMany({
        where: { classId: { in: classIds }, deletedAt: null, status: "ACTIVE" },
        select: { id: true, classId: true },
      }),
    ]);
    const classNameById = new Map(classes.map((c) => [c.id, c.name]));
    const classByChild = new Map(
      classChildren.map((c) => [c.id, c.classId as string]),
    );

    const guardianships = await prisma.guardianship.findMany({
      where: { childId: { in: classChildren.map((c) => c.id) } },
      select: { childId: true, parentUserId: true },
    });

    // One notification per (parent, class), even if they guard several children
    // in the same class.
    const seen = new Set<string>();
    for (const g of guardianships) {
      const classId = classByChild.get(g.childId);
      if (!classId) continue;
      const key = `${g.parentUserId}:${classId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const count = countByClass.get(classId) ?? 0;
      const noun = count === 1 ? "photo" : "photos";
      const className = classNameById.get(classId) ?? "your child's class";
      rows.push({
        userId: g.parentUserId,
        type: "NEW_PHOTOS",
        title: `${count} new class ${noun} in ${className}`,
        body: `${count} new ${noun} shared with ${className}.`,
        payload: { classId, uploadSessionId, count },
        linkPath: `/portal/photos`,
        dedupeKey: `photos:${uploadSessionId}:class:${classId}`,
      });
    }
  }

  if (rows.length === 0) return { created: 0 };

  const result = await prisma.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { created: result.count };
}

// ---------------------------------------------------------------------------
// Fan-out: announcements
// ---------------------------------------------------------------------------

/**
 * Notify the audience of a published announcement.
 *
 * Whole-nursery reaches every parent with a child enrolled; a class announcement
 * reaches the guardians of that class's children. One notification per parent,
 * deduped on the announcement id so a retry — or a re-publish — cannot spam.
 */
export async function fanOutAnnouncement(
  announcementId: string,
): Promise<{ created: number }> {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      title: true,
      audience: true,
      classId: true,
      status: true,
      deletedAt: true,
    },
  });

  if (
    !announcement ||
    announcement.deletedAt ||
    announcement.status !== "PUBLISHED"
  ) {
    return { created: 0 };
  }

  // Which children define the audience.
  const childWhere =
    announcement.audience === "CLASS" && announcement.classId
      ? { classId: announcement.classId, deletedAt: null, status: "ACTIVE" as const }
      : { deletedAt: null, status: "ACTIVE" as const };

  const childIds = (
    await prisma.child.findMany({ where: childWhere, select: { id: true } })
  ).map((c) => c.id);

  if (childIds.length === 0) return { created: 0 };

  const guardianships = await prisma.guardianship.findMany({
    where: { childId: { in: childIds } },
    select: { parentUserId: true },
  });

  // One notification per parent, even if they guard several children in scope.
  const parentIds = [...new Set(guardianships.map((g) => g.parentUserId))];
  if (parentIds.length === 0) return { created: 0 };

  const result = await prisma.notification.createMany({
    data: parentIds.map((userId) => ({
      userId,
      type: "NEW_ANNOUNCEMENT" as const,
      title: "New announcement",
      body: announcement.title,
      payload: { announcementId: announcement.id },
      linkPath: `/portal/announcements`,
      dedupeKey: `announcement:${announcement.id}`,
    })),
    skipDuplicates: true,
  });

  return { created: result.count };
}

/**
 * Remove the notifications for an announcement.
 *
 * Called when an announcement is withdrawn or deleted: the notification links to
 * a portal feed the announcement is no longer in, so leaving it would be a dead
 * end for the family. Removing it also means re-publishing later notifies afresh
 * (the dedupe row is gone), which is what a parent expects.
 */
export async function deleteAnnouncementNotifications(
  announcementId: string,
): Promise<void> {
  await prisma.notification.deleteMany({
    where: { dedupeKey: `announcement:${announcementId}` },
  });
}

// ---------------------------------------------------------------------------
// Fan-out: new album
// ---------------------------------------------------------------------------

/**
 * Notify the families who can see a freshly-published album.
 *
 * One notification per family — "New album: Sports Day" — for every family who
 * can see at least one photo in it, resolved through the same routing rule as
 * the album itself: tagged with their consenting child, or a class-album photo
 * for their class. A family with nothing to see in the album is not told it
 * exists. Deduped on the album id, so a retry — or a withdraw/re-publish — does
 * not spam. (The photos were already announced when published; this is the
 * separate "a collection is ready" event.)
 */
export async function fanOutAlbumPublished(
  albumId: string,
): Promise<{ created: number }> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, status: true, deletedAt: true },
  });
  if (!album || album.deletedAt || album.status !== "PUBLISHED") {
    return { created: 0 };
  }

  const photos = await prisma.photo.findMany({
    where: {
      albumPhotos: { some: { albumId } },
      status: "READY",
      publishedAt: { not: null },
      deletedAt: null,
    },
    select: {
      visibility: true,
      classId: true,
      tags: { where: { child: { photoConsent: true } }, select: { childId: true } },
    },
  });
  if (photos.length === 0) return { created: 0 };

  const taggedChildIds = new Set<string>();
  const albumClassIds = new Set<string>();
  for (const photo of photos) {
    if (photo.visibility === "CLASS_ALBUM" && photo.classId) {
      albumClassIds.add(photo.classId);
    } else {
      for (const tag of photo.tags) taggedChildIds.add(tag.childId);
    }
  }

  // Children whose family can see something: tagged (consenting), plus every
  // active child in a class that has a class-album photo here.
  const classChildren = albumClassIds.size
    ? await prisma.child.findMany({
        where: {
          classId: { in: [...albumClassIds] },
          deletedAt: null,
          status: "ACTIVE",
        },
        select: { id: true },
      })
    : [];

  const audienceChildIds = [
    ...new Set([...taggedChildIds, ...classChildren.map((c) => c.id)]),
  ];
  if (audienceChildIds.length === 0) return { created: 0 };

  const guardianships = await prisma.guardianship.findMany({
    where: { childId: { in: audienceChildIds } },
    select: { parentUserId: true },
  });
  const parentIds = [...new Set(guardianships.map((g) => g.parentUserId))];
  if (parentIds.length === 0) return { created: 0 };

  const result = await prisma.notification.createMany({
    data: parentIds.map((userId) => ({
      userId,
      type: "NEW_PHOTOS" as const,
      title: `New album: ${album.title}`,
      body: `The nursery shared a new album, "${album.title}".`,
      payload: { albumId: album.id },
      linkPath: `/portal/albums/${album.id}`,
      dedupeKey: `album:${album.id}`,
    })),
    skipDuplicates: true,
  });

  return { created: result.count };
}

// ---------------------------------------------------------------------------
// Reads and mark-as-read (the caller's own notifications only)
// ---------------------------------------------------------------------------

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkPath: string;
  readAt: Date | null;
  createdAt: Date;
};

export async function listNotifications(
  session: Session,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<Page<NotificationItem>> {
  const limit = clampPageSize(options.limit ?? 20);
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.notification.findMany({
    // Always scoped to the caller. Notifications are personal, and the id is the
    // only thing a request supplies.
    where: { AND: [{ userId: session.user.id }, ...olderThan(cursor)] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkPath: true,
      readAt: true,
      createdAt: true,
    },
  });

  return buildPage(rows, limit, (row) => ({ at: row.createdAt, id: row.id }));
}

export async function unreadNotificationCount(session: Session): Promise<number> {
  return prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });
}

/**
 * Mark one notification read.
 *
 * Scoped by `userId` in the WHERE, so passing another person's notification id
 * updates nothing rather than reaching across accounts.
 */
export async function markNotificationRead(
  session: Session,
  notificationId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * Mark a notification read and return where it points.
 *
 * Used when a parent taps the notification itself: it should navigate AND clear.
 * The destination is the notification's own stored `linkPath`, looked up here
 * (scoped to the caller) rather than trusted from the form — so the redirect
 * target is always one we wrote, never one a request supplied.
 */
export async function openNotification(
  session: Session,
  notificationId: string,
): Promise<string | null> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: session.user.id },
    select: { linkPath: true },
  });
  if (!notification) return null;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return notification.linkPath;
}

export async function markAllNotificationsRead(session: Session): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** The caller's notification preferences (the three booleans on User). */
export async function getNotificationPreferences(session: Session) {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailNewPhotos: true,
      emailAnnouncements: true,
      emailPickupUpdates: true,
    },
  });
  if (!user) throw new ForbiddenError();
  return user;
}

export async function updateNotificationPreferences(
  session: Session,
  prefs: {
    emailNewPhotos: boolean;
    emailAnnouncements: boolean;
    emailPickupUpdates: boolean;
  },
) {
  return prisma.user.update({
    where: { id: session.user.id },
    data: prefs,
    select: {
      emailNewPhotos: true,
      emailAnnouncements: true,
      emailPickupUpdates: true,
    },
  });
}
