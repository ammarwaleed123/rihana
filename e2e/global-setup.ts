/**
 * Runs once before the whole Playwright suite.
 *
 * Resets the demo roster and clears rate-limit buckets so a run always starts
 * from a known state — previously each spec depended on someone having run
 * `scripts/reset-demo.ts` by hand, and a leftover bucket from an earlier run
 * would fail unrelated tests much later with a confusing timeout.
 *
 * The queue is warmed for a related reason. The web process starts pg-boss
 * lazily and `enqueue` gives up after five seconds, so on a cold database the
 * first upload's thumbnail job was dropped while pg-boss ran its migrations —
 * leaving that photo PROCESSING, which means invisible. That produced a
 * failure two tests later, pointing at the album picker rather than at the
 * queue. Warming it here removes the stall; the maintenance sweep is what
 * actually recovers a dropped job in production.
 */

import { execSync } from "node:child_process";

export default function globalSetup() {
  console.log("[e2e] resetting demo data, rate limits and the queue…");

  execSync("npx tsx scripts/reset-demo.ts", { stdio: "inherit" });
  execSync("npx tsx scripts/reset-limits.ts", { stdio: "inherit" });
  execSync("npx tsx scripts/warm-queue.ts", { stdio: "inherit" });
}
