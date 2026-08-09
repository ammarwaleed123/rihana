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
import { deliverPush } from "@/lib/data/push";
import type { Session } from "@/lib/data/sessions";
import type { NotificationMessage } from "@/lib/i18n/notification-text";
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

/**
 * What goes into `Notification.payload`.
 *
 * The message (key + the words' ingredients) travels alongside the ids the app
 * already kept there for linking and debugging. `NotificationMessage` is the
 * part `notification-text.ts` reads back; the rest is ignored by it.
 */
type StoredPayload = NotificationMessage & Record<string, unknown>;

type NotificationRow = {
  userId: string;
  type:
    | "NEW_PHOTOS"
    | "NEW_ANNOUNCEMENT"
    | "PICKUP_APPROVED"
    | "PICKUP_REJECTED"
    | "PICKUP_PENDING_REVIEW";
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
      const resolvedName = nameById.get(g.childId) ?? "";
      const name = resolvedName || "your child";
      const noun = count === 1 ? "photo" : "photos";
      rows.push({
        userId: g.parentUserId,
        type: "NEW_PHOTOS",
        title: `${count} new ${noun} of ${name}`,
        body: `${count} new ${noun} of ${name} ${count === 1 ? "is" : "are"} ready to see.`,
        payload: {
          kind: "photos.child",
          childId: g.childId,
          uploadSessionId,
          count,
          childName: resolvedName,
        } satisfies StoredPayload,
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
      const resolvedClass = classNameById.get(classId) ?? "";
      const className = resolvedClass || "your child's class";
      rows.push({
        userId: g.parentUserId,
        type: "NEW_PHOTOS",
        title: `${count} new class ${noun} in ${className}`,
        body: `${count} new ${noun} shared with ${className}.`,
        payload: {
          kind: "photos.class",
          classId,
          uploadSessionId,
          count,
          className: resolvedClass,
        } satisfies StoredPayload,
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

  await deliverPush(rows, result.count);
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

  const rows = parentIds.map((userId) => ({
    userId,
    type: "NEW_ANNOUNCEMENT" as const,
    title: "New announcement",
    body: announcement.title,
    payload: {
      kind: "announcement.new",
      announcementId: announcement.id,
      announcementTitle: announcement.title,
    } satisfies StoredPayload,
    linkPath: `/portal/announcements`,
    dedupeKey: `announcement:${announcement.id}`,
  }));

  const result = await prisma.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });

  await deliverPush(rows, result.count);
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

  const rows = parentIds.map((userId) => ({
    userId,
    type: "NEW_PHOTOS" as const,
    title: `New album: ${album.title}`,
    body: `The nursery shared a new album, "${album.title}".`,
    payload: {
      kind: "album.shared",
      albumId: album.id,
      albumTitle: album.title,
    } satisfies StoredPayload,
    linkPath: `/portal/albums/${album.id}`,
    dedupeKey: `album:${album.id}`,
  }));

  const result = await prisma.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });

  await deliverPush(rows, result.count);
  return { created: result.count };
}

// ---------------------------------------------------------------------------
// Fan-out: pickup authorization
// ---------------------------------------------------------------------------

/**
 * Tell the owners a pickup person is waiting to be reviewed.
 *
 * Notifies every active owner — approval is an owner responsibility, and a
 * nursery may have more than one. Deduped on the person *and* their `updatedAt`,
 * so a worker retry no-ops while a genuine re-submission (the parent edited the
 * person, which returns them to PENDING and bumps `updatedAt`) produces a fresh
 * prompt. Guarded on the current status, so a request the owner has already
 * handled between enqueue and execution raises nothing.
 */
export async function fanOutPickupPendingReview(
  pickupPersonId: string,
): Promise<{ created: number }> {
  const person = await prisma.pickupPerson.findFirst({
    where: { id: pickupPersonId, deletedAt: null, status: "PENDING" },
    select: {
      id: true,
      fullName: true,
      updatedAt: true,
      child: { select: { firstName: true } },
      addedBy: { select: { name: true } },
    },
  });
  if (!person) return { created: 0 };

  const owners = await prisma.user.findMany({
    where: { role: "OWNER", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (owners.length === 0) return { created: 0 };

  const requestedBy = person.addedBy?.name ?? "A parent";
  const childName = person.child.firstName;
  const dedupeKey = `pickup-review:${person.id}:${person.updatedAt.getTime()}`;

  const rows = owners.map((owner) => ({
    userId: owner.id,
    type: "PICKUP_PENDING_REVIEW" as const,
    title: "Pickup approval needed",
    body: `${requestedBy} asked to authorize ${person.fullName} to collect ${childName}.`,
    payload: {
      kind: "pickup.review",
      pickupPersonId: person.id,
      requestedBy,
      personName: person.fullName,
      childName,
    } satisfies StoredPayload,
    linkPath: `/admin/pickup/approvals`,
    dedupeKey,
  }));

  const result = await prisma.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });

  await deliverPush(rows, result.count);
  return { created: result.count };
}

/**
 * Tell the parent who requested a pickup person how it was reviewed.
 *
 * Reaches the parent who added them (not every guardian — the requester is who
 * is waiting on the answer). Approved and rejected are two different rows with
 * two different links. Deduped on the person and their `reviewedAt`, so a
 * re-approval after an edit notifies afresh while a retry does not. Reads the
 * current status, so if the person has since been edited back to PENDING nothing
 * is sent.
 */
export async function fanOutPickupReviewed(
  pickupPersonId: string,
): Promise<{ created: number }> {
  const person = await prisma.pickupPerson.findFirst({
    where: { id: pickupPersonId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      status: true,
      reviewedAt: true,
      rejectionReason: true,
      addedByUserId: true,
      child: { select: { firstName: true } },
    },
  });

  if (
    !person ||
    !person.reviewedAt ||
    (person.status !== "APPROVED" && person.status !== "REJECTED")
  ) {
    return { created: 0 };
  }

  const childName = person.child.firstName;
  const approved = person.status === "APPROVED";

  const row: NotificationRow = approved
    ? {
        userId: person.addedByUserId,
        type: "PICKUP_APPROVED",
        title: "Pickup authorized",
        body: `${person.fullName} can now collect ${childName} from the nursery.`,
        payload: {
          kind: "pickup.approved",
          pickupPersonId: person.id,
          personName: person.fullName,
          childName,
        } satisfies StoredPayload,
        linkPath: `/portal/pickup`,
        dedupeKey: `pickup-approved:${person.id}:${person.reviewedAt.getTime()}`,
      }
    : {
        userId: person.addedByUserId,
        type: "PICKUP_REJECTED",
        title: "Pickup not approved",
        body: person.rejectionReason
          ? `Your request to authorize ${person.fullName} for ${childName} was not approved: ${person.rejectionReason}`
          : `Your request to authorize ${person.fullName} to collect ${childName} was not approved. Please contact the nursery.`,
        payload: {
          kind: "pickup.rejected",
          pickupPersonId: person.id,
          personName: person.fullName,
          childName,
          ...(person.rejectionReason
            ? { reason: person.rejectionReason }
            : {}),
        } satisfies StoredPayload,
        linkPath: `/portal/pickup`,
        dedupeKey: `pickup-rejected:${person.id}:${person.reviewedAt.getTime()}`,
      };

  const result = await prisma.notification.createMany({
    data: [row],
    skipDuplicates: true,
  });

  await deliverPush([row], result.count);
  return { created: result.count };
}

// ---------------------------------------------------------------------------
// Fan-out: new website enquiry
// ---------------------------------------------------------------------------

/**
 * Tell the owners a family enquired through the public website.
 *
 * The public site's one write action, so this is how a lead reaches the owner's
 * bell without them having to sit on the admin dashboard. One notification per
 * active owner, deduped on the inquiry id so a worker retry no-ops.
 */
export async function fanOutNewInquiry(
  inquiryId: string,
): Promise<{ created: number }> {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, parentName: true, childFirstName: true, kind: true },
  });
  if (!inquiry) return { created: 0 };

  const owners = await prisma.user.findMany({
    where: { role: "OWNER", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (owners.length === 0) return { created: 0 };

  const about = inquiry.childFirstName ? ` about ${inquiry.childFirstName}` : "";
  const isVisit = inquiry.kind === "VISIT";
  const title = isVisit ? "New visit request" : "New website enquiry";
  const body = isVisit
    ? `${inquiry.parentName} asked to book a visit${about}.`
    : `${inquiry.parentName} enquired about a place${about}.`;
  const rows = owners.map((owner) => ({
    userId: owner.id,
    type: "NEW_INQUIRY" as const,
    title,
    body,
    payload: { inquiryId: inquiry.id },
    linkPath: `/admin/inquiries/${inquiry.id}`,
    dedupeKey: `inquiry:${inquiry.id}`,
  }));

  const result = await prisma.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });

  await deliverPush(rows, result.count);
  return { created: result.count };
}

// ---------------------------------------------------------------------------
// Reads and mark-as-read (the caller's own notifications only)
// ---------------------------------------------------------------------------

export type NotificationItem = {
  id: string;
  type: string;
  /** The English sentence written at send time; the fallback for old rows. */
  title: string;
  body: string;
  /** Message key + ingredients. Read through `notificationText()`, never raw. */
  payload: unknown;
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
      // `title`/`body` are the English sentence written at send time. They are
      // still the fallback for rows created before messages carried a key —
      // see notification-text.ts.
      title: true,
      body: true,
      payload: true,
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
