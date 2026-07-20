/**
 * Runs once before the whole Playwright suite.
 *
 * Resets the demo roster and clears rate-limit buckets so a run always starts
 * from a known state — previously each spec depended on someone having run
 * `scripts/reset-demo.ts` by hand, and a leftover bucket from an earlier run
 * would fail unrelated tests much later with a confusing timeout.
 */

import { execSync } from "node:child_process";

export default function globalSetup() {
  console.log("[e2e] resetting demo data and rate limits…");

  execSync("npx tsx scripts/reset-demo.ts", { stdio: "inherit" });
  execSync("npx tsx scripts/reset-limits.ts", { stdio: "inherit" });
}
