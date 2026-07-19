/**
 * Wipe all application data and reseed the demo roster.
 *
 * For getting back to a known state before a manual test pass — the end-to-end
 * suite deliberately creates classes, children and invitations, which otherwise
 * accumulate.
 *
 * Refuses to run against production. Deletes in foreign-key order rather than
 * relying on cascades, so the intent is explicit.
 *
 *   npx tsx scripts/reset-demo.ts
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run against NODE_ENV=production.");
  process.exit(1);
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

console.log("Clearing application data…");

// Order matters: children before parents, edges before nodes.
await prisma.auditLog.deleteMany({});
await prisma.notification.deleteMany({});
await prisma.outboundEmail.deleteMany({});
await prisma.albumPhoto.deleteMany({});
await prisma.album.deleteMany({});
await prisma.photoTag.deleteMany({});
await prisma.photo.deleteMany({});
await prisma.uploadSession.deleteMany({});
await prisma.pickupPerson.deleteMany({});
await prisma.announcement.deleteMany({});
await prisma.guardianship.deleteMany({});
await prisma.teacherAssignment.deleteMany({});
await prisma.child.deleteMany({});
await prisma.class.deleteMany({});
await prisma.session.deleteMany({});
await prisma.rateLimit.deleteMany({});
await prisma.inquiry.deleteMany({});
await prisma.user.deleteMany({});

console.log("Cleared. Reseeding…\n");

await prisma.$disconnect();

// Hand off to the seed, which is the single definition of the demo roster.
await import("../prisma/seed.js").catch(async () => {
  const { execSync } = await import("node:child_process");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
});
