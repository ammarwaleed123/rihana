/**
 * Isolate the child-deletion path from the UI.
 *
 *   npx tsx scripts/probe-delete.ts
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

const child = await prisma.child.create({
  data: {
    firstName: "Probe",
    lastName: `Delete${Date.now().toString().slice(-5)}`,
    dateOfBirth: new Date("2023-01-01"),
    photoConsent: true,
  },
  select: { id: true, firstName: true, lastName: true },
});
console.log(`created ${child.firstName} ${child.lastName} (${child.id})`);

// Give it an audit row, as the real flow would.
await prisma.auditLog.create({
  data: {
    action: "child.created",
    targetType: "child",
    targetId: child.id,
    childId: child.id,
    summary: "probe",
  },
});
console.log("audit row created referencing the child");

try {
  await prisma.$transaction([
    prisma.albumPhoto.deleteMany({ where: { photoId: { in: [] } } }),
    prisma.photoTag.deleteMany({ where: { photoId: { in: [] } } }),
    prisma.photo.deleteMany({ where: { id: { in: [] } } }),
    prisma.photoTag.deleteMany({ where: { childId: child.id } }),
    prisma.guardianship.deleteMany({ where: { childId: child.id } }),
    prisma.pickupPerson.deleteMany({ where: { childId: child.id } }),
    prisma.child.delete({ where: { id: child.id } }),
  ]);
  console.log("transaction OK");
} catch (error) {
  console.log("TRANSACTION FAILED:");
  console.log("  name:", (error as Error).name);
  console.log("  code:", (error as { code?: string }).code);
  console.log("  message:", (error as Error).message?.slice(0, 400));
}

const still = await prisma.child.findUnique({ where: { id: child.id } });
console.log(still ? "child STILL EXISTS" : "child is gone");

const audit = await prisma.auditLog.findFirst({
  where: { targetId: child.id },
  select: { childId: true, summary: true },
});
console.log("audit row after delete:", audit);

// Clean up if the delete failed.
if (still) {
  await prisma.auditLog.deleteMany({ where: { targetId: child.id } });
  await prisma.child.delete({ where: { id: child.id } }).catch(() => {});
}

await prisma.$disconnect();
