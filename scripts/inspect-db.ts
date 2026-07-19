/**
 * Ad-hoc inspection of auth-related tables. Development aid, not shipped behaviour.
 *
 *   npx tsx scripts/inspect-db.ts
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

const sessions = await prisma.session.findMany({
  include: { user: { select: { email: true, role: true } } },
  orderBy: { createdAt: "desc" },
  take: 8,
});

console.log(`\nSessions (${sessions.length}):`);
for (const s of sessions) {
  console.log(
    `  ${s.user.email.padEnd(26)} ${s.user.role.padEnd(8)} id=${s.id.slice(0, 12)}… ua=${s.userAgent?.slice(0, 18) ?? "-"}`,
  );
}

const audit = await prisma.auditLog.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
});

console.log(`\nAudit log (${audit.length} most recent):`);
for (const a of audit) {
  console.log(
    `  ${a.action.padEnd(24)} ${a.summary.padEnd(34)} ip=${a.ipHash ? `${a.ipHash.slice(0, 10)}…` : "null"}`,
  );
}

const limits = await prisma.rateLimit.findMany({ take: 10 });
console.log(`\nRate-limit buckets (${limits.length}):`);
for (const l of limits) {
  console.log(`  ${l.key.slice(0, 30)}… count=${l.count} expires=${l.expiresAt.toISOString().slice(11, 19)}`);
}

console.log("");
await prisma.$disconnect();
