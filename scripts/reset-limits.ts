/**
 * Clear rate-limit buckets, account lockouts and interface language.
 *
 * Development aid: the end-to-end tests deliberately exhaust the limits, and a
 * subsequent run would otherwise start against a poisoned bucket.
 *
 * Language is reset for the same reason. Every spec asserts English copy, so an
 * account left on Arabic — by a manual click on "Save language", or by a probe
 * that set it and died before restoring — makes the whole suite fail on text
 * that is present and correct, just in the other language. That reads as a
 * regression in whatever each test happened to be about, which is the most
 * expensive kind of red. The seed already lands on English; this makes it true
 * even when only part of the setup ran.
 *
 *   npx tsx scripts/reset-limits.ts
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const buckets = await prisma.rateLimit.deleteMany({});
const users = await prisma.user.updateMany({
  data: { failedLoginCount: 0, lockedUntil: null },
});
const relocalized = await prisma.user.updateMany({
  where: { locale: { not: "en" } },
  data: { locale: "en" },
});

console.log(
  `cleared ${buckets.count} rate-limit bucket(s), reset lockout on ${users.count} account(s)` +
    (relocalized.count > 0
      ? `, put ${relocalized.count} account(s) back on English`
      : ""),
);

await prisma.$disconnect();
