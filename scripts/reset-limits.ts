/**
 * Clear rate-limit buckets and account lockouts.
 *
 * Development aid: the end-to-end tests deliberately exhaust these, and a
 * subsequent run would otherwise start against a poisoned bucket.
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

console.log(
  `cleared ${buckets.count} rate-limit bucket(s), reset lockout on ${users.count} account(s)`,
);

await prisma.$disconnect();
