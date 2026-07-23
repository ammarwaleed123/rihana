/**
 * Background worker.
 *
 *   npm run worker
 *
 * Runs as its own process in production so that app servers stay stateless and
 * can be scaled or restarted without losing in-flight work. In development it
 * can run alongside `npm run dev` in a second terminal.
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { QUEUES, getBoss, stopBoss } = await import("@/lib/jobs/queue");
const { HANDLERS } = await import("@/lib/jobs/handlers");
const { env } = await import("@/lib/env");
const { logger, reportError } = await import("@/lib/logger");

async function main() {
  const boss = await getBoss();

  for (const [queue, handler] of Object.entries(HANDLERS)) {
    await boss.createQueue(queue);

    await boss.work(
      queue,
      { batchSize: env.JOB_CONCURRENCY },
      async (jobs: Array<{ id: string; data: unknown }>) => {
        for (const job of jobs) {
          try {
            await (handler as (data: unknown) => Promise<void>)(job.data);
          } catch (error) {
            reportError(error, { scope: "worker", queue, jobId: job.id });
            // Rethrow so pg-boss records the failure and schedules a retry.
            throw error;
          }
        }
      },
    );

    logger.info({ queue }, "worker listening");
  }

  /*
   * Housekeeping every five minutes. `singletonKey` keeps a second worker
   * process from scheduling a duplicate.
   *
   * It was fifteen. The sweep now also rescues photos stranded in PROCESSING by
   * a failed enqueue, and that is time a family spends unable to see a
   * photograph of their child — so the cadence is set by how long that is
   * tolerable, not by how often expired sessions need clearing. The sweep is
   * three cheap indexed queries; running it more often costs nothing.
   */
  await boss.schedule(QUEUES.maintenance, "*/5 * * * *", {}, {
    singletonKey: "maintenance",
  });

  logger.info(
    { queues: Object.keys(HANDLERS).length },
    "worker started",
  );
}

async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutting down");
  // Graceful: in-flight jobs finish rather than being abandoned mid-write.
  await stopBoss();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
