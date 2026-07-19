/**
 * Print the current roster — classes, children, accounts.
 *
 * Development aid for checking what state the database is actually in before a
 * manual test pass.
 *
 *   npx tsx scripts/inspect-roster.ts
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

const classes = await prisma.class.findMany({
  where: { archivedAt: null },
  orderBy: { name: "asc" },
  select: { name: true, _count: { select: { children: true, teachers: true } } },
});

console.log(`\nClasses (${classes.length}):`);
for (const c of classes) {
  console.log(
    `  ${c.name.padEnd(24)} ${c._count.children} children, ${c._count.teachers} teachers`,
  );
}

const children = await prisma.child.findMany({
  where: { deletedAt: null },
  orderBy: [{ createdAt: "asc" }],
  select: {
    firstName: true,
    lastName: true,
    status: true,
    photoConsent: true,
    class: { select: { name: true } },
    guardianships: { select: { parent: { select: { name: true } } } },
  },
});

console.log(`\nChildren (${children.length}):`);
for (const c of children) {
  const guardians =
    c.guardianships.map((g) => g.parent.name).join(", ") || "NO GUARDIAN";
  console.log(
    `  ${`${c.firstName} ${c.lastName}`.padEnd(24)} ${(c.class?.name ?? "unassigned").padEnd(14)} ${c.status.padEnd(9)} consent=${c.photoConsent ? "yes" : "NO "}  ${guardians}`,
  );
}

const users = await prisma.user.findMany({
  where: { deletedAt: null },
  orderBy: [{ role: "asc" }, { email: "asc" }],
  select: { email: true, name: true, role: true, status: true },
});

console.log(`\nAccounts (${users.length}):`);
for (const u of users) {
  console.log(
    `  ${u.email.padEnd(34)} ${u.role.padEnd(8)} ${u.status.padEnd(9)} ${u.name}`,
  );
}

console.log("");
await prisma.$disconnect();
