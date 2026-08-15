import "server-only";

// pg-boss v12 exports named, not default.
import { PgBoss } from "pg-boss";
import type { SendOptions } from "pg-boss";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Background jobs, on the Postgres we already run.
 *
 * pg-boss keeps its own `pgboss` schema. That is a deliberate ceiling on
 * infrastructure: an upload of 200 photos must not block the admin's request,
 * but that requirement does not justify operating a Redis instance as well.
 *
 * Jobs are retried with backoff and are idempotent — see the unique
 * (userId, dedupeKey) constraint on notifications, which is what makes a
 * retried fan-out incapable of emailing a parent twice.
 */

export const QUEUES = {
  /** Generate a thumbnail and mark a photo READY. */
  photoProcess: "photo.process",
  /** Fan out notifications for a published upload session. */
  notifyPhotosPublished: "notify.photos-published",
  /** Fan out notifications for a published announcement. */
  notifyAnnouncement: "notify.announcement",
  /** Fan out notifications for a published album. */
  notifyAlbumPublished: "notify.album-published",
  /** Tell the owners a pickup person is waiting to be reviewed. */
  notifyPickupPending: "notify.pickup-pending",
  /** Tell the parent how their pickup request was reviewed. */
  notifyPickupReviewed: "notify.pickup-reviewed",
  /** Tell the owners a family enquired through the public website. */
  notifyNewInquiry: "notify.new-inquiry",
  /** Tell a family their child's day is ready, changed, or was an absence. */
  notifyDailyReport: "notify.daily-report",
  /** Tell a family their child was hurt, or that the record was corrected. */
  notifyAccident: "notify.accident",
  /** Tell staff a family has signed an accident record. */
  notifyAccidentAcknowledged: "notify.accident-acknowledged",
  /** Send one queued email. */
  emailSend: "email.send",
  /** Remove objects from storage after a deletion. */
  storagePurge: "storage.purge",
  /** Housekeeping: expired sessions and rate-limit buckets. */
  maintenance: "maintenance",
} as const;

export type PhotoProcessJob = { photoId: string };
export type NotifyPhotosPublishedJob = { uploadSessionId: string };
export type NotifyAnnouncementJob = { announcementId: string };
export type NotifyAlbumPublishedJob = { albumId: string };
export type NotifyPickupPendingJob = { pickupPersonId: string };
export type NotifyPickupReviewedJob = { pickupPersonId: string };
export type NotifyNewInquiryJob = { inquiryId: string };
export type NotifyDailyReportJob = {
  reportId: string;
  event: "ready" | "updated" | "absent";
};
export type NotifyAccidentJob = { incidentId: string };
export type NotifyAccidentAcknowledgedJob = {
  incidentId: string;
  parentUserId: string;
};
export type EmailSendJob = { outboundEmailId: string };
export type StoragePurgeJob = { keys: string[] };

let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

/**
 * Shared pg-boss instance.
 *
 * Uses the direct connection rather than the pooled one: pg-boss holds
 * long-lived listeners and advisory locks, which a transaction pooler
 * terminates.
 */
export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;

  if (!starting) {
    starting = (async () => {
      const instance = new PgBoss({
        connectionString: env.DIRECT_URL,
        // Two connections is plenty: the web process only ever publishes jobs,
        // and these are direct connections, which Supabase caps far lower than
        // pooled ones. The worker is where concurrency belongs.
        max: 2,
      });

      instance.on("error", (error: Error) => {
        logger.error({ err: error, scope: "pg-boss" }, "queue error");
      });

      await instance.start();
      boss = instance;
      return instance;
    })().catch((error) => {
      // Clear the cached promise so a later request can try again. Without
      // this, one failed startup would poison the queue for the lifetime of
      // the process.
      starting = null;
      throw error;
    });
  }

  return starting;
}

/**
 * Publish a job.
 *
 * Never throws into the caller: failing to enqueue a thumbnail must not fail the
 * upload the parent is waiting on. The failure is logged loudly, and the photo
 * stays in PROCESSING where the maintenance sweep can find it.
 */
/**
 * How long a request may wait on the queue before giving up.
 *
 * The web process starts its own pg-boss connection lazily, and that first
 * start does real work — connecting, running pg-boss's own migrations, taking
 * advisory locks. Under connection pressure it can block for minutes, which is
 * unacceptable on a request a person is waiting on: an upload's job is to store
 * photos, and enqueueing a thumbnail is a nice-to-have on top of that.
 *
 * On timeout the photo stays in PROCESSING, where the maintenance sweep and a
 * manual re-run can still pick it up.
 */
const ENQUEUE_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function enqueue<T extends object>(
  queue: string,
  data: T,
  options: SendOptions = {},
): Promise<string | null> {
  if (!env.JOBS_ENABLED) return null;

  try {
    const instance = await withTimeout(
      getBoss(),
      ENQUEUE_TIMEOUT_MS,
      "queue startup",
    );

    return await withTimeout(
      instance.send(queue, data, {
        // Retries with exponential backoff: a storage or email provider blip
        // should resolve itself rather than lose the job.
        retryLimit: 5,
        retryDelay: 5,
        retryBackoff: true,
        // Completed jobs are useful for a day when something has gone wrong,
        // and noise after that. Retention lives on the job in pg-boss v12, not
        // on the constructor.
        deleteAfterSeconds: 86_400,
        ...options,
      }),
      ENQUEUE_TIMEOUT_MS,
      "queue send",
    );
  } catch (error) {
    logger.error({ err: error, scope: "enqueue", queue }, "failed to enqueue job");
    return null;
  }
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
    starting = null;
  }
}
