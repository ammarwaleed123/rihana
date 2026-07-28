/**
 * Seed the demo WITH sample photos — the owner's populated click-through demo.
 *
 * Two differences from plain `db:seed`: it sets SEED_PHOTOS so seed.ts runs the
 * photo step, and it is launched under the worker tsconfig (see the
 * `db:seed:demo` script) so the server-only storage + sharp modules resolve
 * through the shim instead of throwing. Plain `db:seed` stays roster-only, which
 * is what the e2e reset uses.
 *
 * For a clean populated demo, wipe first (`npx tsx scripts/reset-demo.ts`),
 * then run this. On an existing DB it is idempotent (upserts, overwrites).
 */
export {};

process.env.SEED_PHOTOS = "1";

await import("./seed.js");
