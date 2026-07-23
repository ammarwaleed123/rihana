/**
 * Start pg-boss once, so its schema and migrations exist before anything else
 * needs them.
 *
 *   npx tsx scripts/warm-queue.ts
 *
 * Why this exists: the web process starts pg-boss lazily, and that first start
 * runs pg-boss's own migrations. `enqueue` is bounded at five seconds and never
 * throws, so on a cold database the very first upload's thumbnail job is simply
 * dropped — the photo stays PROCESSING and is invisible to families until the
 * maintenance sweep rescues it minutes later.
 *
 * The sweep is the real fix and it exists. This just removes the stall from the
 * first upload after a fresh database, which in practice means the end-to-end
 * suite and a developer's first run of the day.
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

if (process.env.JOBS_ENABLED === "false") {
  console.log("[warm-queue] jobs disabled, nothing to do");
  process.exit(0);
}

const { PgBoss } = await import("pg-boss");

const boss = new PgBoss({
  connectionString: process.env.DIRECT_URL!,
  max: 2,
});

const started = Date.now();
await boss.start();

// Create the queues up front too. pg-boss v12 requires a queue to exist before
// a job can be sent to it, and the worker is not necessarily running yet.
for (const queue of [
  "photo.process",
  "notify.photos-published",
  "notify.announcement",
  "email.send",
  "storage.purge",
  "maintenance",
]) {
  await boss.createQueue(queue);
}

await boss.stop({ graceful: true });

console.log(`[warm-queue] queue ready in ${Date.now() - started}ms`);
