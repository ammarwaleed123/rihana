import "server-only";

import { createThumbnail } from "@/lib/images/process";
import {
  enqueue,
  QUEUES,
  type NotifyAlbumPublishedJob,
  type NotifyAnnouncementJob,
  type NotifyPhotosPublishedJob,
  type NotifyNewInquiryJob,
  type NotifyPickupPendingJob,
  type NotifyPickupReviewedJob,
  type PhotoProcessJob,
  type StoragePurgeJob,
} from "@/lib/jobs/queue";
import { logger, reportError } from "@/lib/logger";
import { photoKey, storage } from "@/lib/storage";
import { prisma } from "@/lib/db";
import {
  fanOutAlbumPublished,
  fanOutAnnouncement,
  fanOutNewInquiry,
  fanOutPhotosPublished,
  fanOutPickupPendingReview,
  fanOutPickupReviewed,
} from "@/lib/data/notifications";
import { purgeExpiredRateLimits } from "@/lib/data/rate-limit";
import { purgeExpiredSessions } from "@/lib/data/sessions";

/**
 * Job handlers.
 *
 * Every handler must be idempotent: pg-boss retries on failure, and a retry that
 * duplicates work is worse than the original failure. Where the work has a
 * visible side effect — a notification, an email — idempotency is enforced by a
 * unique constraint rather than by a check-then-act, which races.
 */

/**
 * Generate a thumbnail, record dimensions, mark the photo READY.
 *
 * Until this runs the photo has status PROCESSING and is not visible to anyone,
 * which is why an upload of 200 photos can return immediately: the admin's
 * request only has to persist the originals.
 */
export async function handlePhotoProcess(job: PhotoProcessJob): Promise<void> {
  const photo = await prisma.photo.findUnique({
    where: { id: job.photoId },
    select: {
      id: true,
      status: true,
      storageKeyOriginal: true,
      storageKeyThumb: true,
      deletedAt: true,
    },
  });

  if (!photo || photo.deletedAt) {
    // Deleted between enqueue and execution. Nothing to do, and not an error.
    logger.info({ photoId: job.photoId }, "photo gone before processing");
    return;
  }

  // Idempotent: a retry after a successful run has nothing left to do.
  if (photo.status === "READY" && photo.storageKeyThumb) return;

  try {
    const original = await storage.get(photo.storageKeyOriginal);
    const thumb = await createThumbnail(original);
    const thumbKey = photoKey(photo.id, "thumb");

    await storage.put(thumbKey, thumb.buffer, { contentType: "image/jpeg" });

    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        storageKeyThumb: thumbKey,
        status: "READY",
      },
    });

    logger.info({ photoId: photo.id }, "photo processed");
  } catch (error) {
    // QUARANTINED, not FAILED: this photo could not be decoded into something we
    // are willing to serve, and it must never be served.
    await prisma.photo.update({
      where: { id: photo.id },
      data: { status: "QUARANTINED" },
    });

    reportError(error, { scope: "photo.process", photoId: photo.id });
    throw error;
  }
}

/**
 * Remove objects from storage.
 *
 * Runs after a child or photo is erased. Deliberately separate from the database
 * deletion: the row must go immediately when a family asks, and storage cleanup
 * can retry for as long as it needs to without holding that up.
 */
export async function handleStoragePurge(job: StoragePurgeJob): Promise<void> {
  if (job.keys.length === 0) return;

  await storage.deleteMany(job.keys);
  logger.info({ count: job.keys.length }, "purged storage objects");
}

/** Housekeeping. Expired rows are not sensitive, but they are not free either. */
/**
 * How long a photo may sit in PROCESSING before the sweep assumes its job was
 * lost. Comfortably longer than a real thumbnail takes, short enough that a
 * family is not waiting on the next sweep for an hour.
 */
const STUCK_PHOTO_AFTER_MS = 2 * 60 * 1000;

/** Bounded per sweep: a backlog should drain over several passes, not one. */
const STUCK_PHOTO_BATCH = 100;

/**
 * Re-enqueue photos stranded in PROCESSING.
 *
 * Enqueueing is deliberately non-fatal — an upload's job is to store photos,
 * and a queue blip must not fail the request someone is waiting on. The cost of
 * that choice is that a photo whose job never got published stays PROCESSING,
 * and PROCESSING means invisible to every family, permanently, with nothing but
 * a small badge on an admin screen to say so.
 *
 * Two comments in this codebase already claimed the maintenance sweep picked
 * these up. It did not — this is the code that makes the claim true. Found
 * because a photo published in a test never appeared: the very first enqueue
 * after a cold start had timed out while pg-boss ran its own migrations, which
 * is exactly the situation the timeout exists to survive.
 */
export async function requeueStuckPhotos(): Promise<number> {
  const stuck = await prisma.photo.findMany({
    where: {
      status: "PROCESSING",
      deletedAt: null,
      createdAt: { lt: new Date(Date.now() - STUCK_PHOTO_AFTER_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: STUCK_PHOTO_BATCH,
    select: { id: true },
  });

  if (stuck.length === 0) return 0;

  // `photo.process` is idempotent, so re-enqueueing one that is merely slow
  // rather than lost costs a wasted lookup and nothing else.
  const results = await Promise.allSettled(
    stuck.map((photo) => enqueue(QUEUES.photoProcess, { photoId: photo.id })),
  );

  const requeued = results.filter(
    (result) => result.status === "fulfilled" && result.value !== null,
  ).length;

  logger.warn(
    { found: stuck.length, requeued },
    "re-enqueued photos stuck in PROCESSING",
  );

  return requeued;
}

export async function handleMaintenance(): Promise<void> {
  const [sessions, limits, photos] = await Promise.all([
    purgeExpiredSessions(),
    purgeExpiredRateLimits(),
    requeueStuckPhotos(),
  ]);

  if (sessions > 0 || limits > 0 || photos > 0) {
    logger.info({ sessions, limits, photos }, "maintenance sweep");
  }
}

/**
 * Fan out notifications for a freshly-published upload.
 *
 * Idempotent through the unique `(userId, dedupeKey)` on notifications, so a
 * pg-boss retry re-runs this safely — the second pass creates nothing.
 */
export async function handleNotifyPhotosPublished(
  job: NotifyPhotosPublishedJob,
): Promise<void> {
  const { created } = await fanOutPhotosPublished(job.uploadSessionId);
  logger.info(
    { uploadSessionId: job.uploadSessionId, created },
    "photo notifications fanned out",
  );
}

/** Fan out notifications for a published announcement. Idempotent, as above. */
export async function handleNotifyAnnouncement(
  job: NotifyAnnouncementJob,
): Promise<void> {
  const { created } = await fanOutAnnouncement(job.announcementId);
  logger.info(
    { announcementId: job.announcementId, created },
    "announcement notifications fanned out",
  );
}

/** Fan out notifications for a published album. Idempotent, as above. */
export async function handleNotifyAlbumPublished(
  job: NotifyAlbumPublishedJob,
): Promise<void> {
  const { created } = await fanOutAlbumPublished(job.albumId);
  logger.info({ albumId: job.albumId, created }, "album notifications fanned out");
}

/** Tell the owners a pickup person needs review. Idempotent, as above. */
export async function handleNotifyPickupPending(
  job: NotifyPickupPendingJob,
): Promise<void> {
  const { created } = await fanOutPickupPendingReview(job.pickupPersonId);
  logger.info(
    { pickupPersonId: job.pickupPersonId, created },
    "pickup-pending notifications fanned out",
  );
}

/** Tell the parent how their pickup request was reviewed. Idempotent, as above. */
export async function handleNotifyPickupReviewed(
  job: NotifyPickupReviewedJob,
): Promise<void> {
  const { created } = await fanOutPickupReviewed(job.pickupPersonId);
  logger.info(
    { pickupPersonId: job.pickupPersonId, created },
    "pickup-reviewed notification fanned out",
  );
}

/** Tell the owners about a new website enquiry. Idempotent, as above. */
export async function handleNotifyNewInquiry(
  job: NotifyNewInquiryJob,
): Promise<void> {
  const { created } = await fanOutNewInquiry(job.inquiryId);
  logger.info(
    { inquiryId: job.inquiryId, created },
    "new-inquiry notification fanned out",
  );
}

/** Queue name to handler. Used by the worker entry point. */
export const HANDLERS = {
  [QUEUES.photoProcess]: handlePhotoProcess,
  [QUEUES.notifyPhotosPublished]: handleNotifyPhotosPublished,
  [QUEUES.notifyAnnouncement]: handleNotifyAnnouncement,
  [QUEUES.notifyAlbumPublished]: handleNotifyAlbumPublished,
  [QUEUES.notifyPickupPending]: handleNotifyPickupPending,
  [QUEUES.notifyPickupReviewed]: handleNotifyPickupReviewed,
  [QUEUES.notifyNewInquiry]: handleNotifyNewInquiry,
  [QUEUES.storagePurge]: handleStoragePurge,
  [QUEUES.maintenance]: handleMaintenance,
} as const;
