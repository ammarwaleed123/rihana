import "server-only";

import { createThumbnail } from "@/lib/images/process";
import {
  QUEUES,
  type PhotoProcessJob,
  type StoragePurgeJob,
} from "@/lib/jobs/queue";
import { logger, reportError } from "@/lib/logger";
import { photoKey, storage } from "@/lib/storage";
import { prisma } from "@/lib/db";
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
export async function handleMaintenance(): Promise<void> {
  const [sessions, limits] = await Promise.all([
    purgeExpiredSessions(),
    purgeExpiredRateLimits(),
  ]);

  if (sessions > 0 || limits > 0) {
    logger.info({ sessions, limits }, "maintenance sweep");
  }
}

/** Queue name to handler. Used by the worker entry point. */
export const HANDLERS = {
  [QUEUES.photoProcess]: handlePhotoProcess,
  [QUEUES.storagePurge]: handleStoragePurge,
  [QUEUES.maintenance]: handleMaintenance,
} as const;
