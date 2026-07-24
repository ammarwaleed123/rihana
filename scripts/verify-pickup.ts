/**
 * Verify the four pickup behaviours that are awkward to check by hand:
 *   1. an expired authorization drops off the door board on its own;
 *   2. a stale second approval says "already handled", not a double-approve;
 *   3. a request whose end date has passed is flagged expired in the queue;
 *   4. the pending count rises and falls as the queue fills and clears.
 *
 * Runs against the live database using the SAME queries the data layer runs and
 * the REAL isExpired / isActivePickup rules. It creates a few temporary rows on
 * an existing child and deletes exactly those again in a finally block, so the
 * seeded demo state is left untouched.
 *
 *   npx tsx scripts/verify-pickup.ts
 */

import { config as loadEnv } from "dotenv";

import { isActivePickup, isExpired } from "../src/lib/data/pickup-rules";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${name}`);
  }
}

const created: string[] = [];

/** The exact door-board rule: approved, not soft-deleted, not expired. */
async function activePeopleOnBoard(childId: string, now: Date) {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: {
      pickupPersons: {
        where: { status: "APPROVED", deletedAt: null },
        select: { id: true, expiresAt: true },
      },
    },
  });
  return (child?.pickupPersons ?? []).filter((p) => !isExpired(p.expiresAt, now));
}

/** The exact approval write: only a still-PENDING row is changed. */
function approve(id: string, reviewerId: string) {
  return prisma.pickupPerson.updateMany({
    where: { id, status: "PENDING", deletedAt: null },
    data: { status: "APPROVED", reviewedByUserId: reviewerId, reviewedAt: new Date() },
  });
}

function pendingCount() {
  return prisma.pickupPerson.count({
    where: { status: "PENDING", deletedAt: null },
  });
}

async function makePending(childId: string, addedBy: string, expiresAt: Date | null) {
  const p = await prisma.pickupPerson.create({
    data: {
      childId,
      addedByUserId: addedBy,
      fullName: `VERIFY ${Math.random().toString(36).slice(2, 8)}`,
      relationship: "Test",
      phone: "01012345678",
      status: "PENDING",
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
  created.push(p.id);
  return p;
}

async function main() {
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
    select: { id: true },
  });
  const laila = await prisma.child.findFirst({
    where: { firstName: "Laila" },
    select: { id: true },
  });
  const amal = await prisma.user.findFirst({
    where: { email: "amal@rihana.test" },
    select: { id: true },
  });
  if (!owner || !laila || !amal) {
    throw new Error("Seed data missing — run `npm run db:seed` first.");
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  console.log("\n(3) An end date in the past is flagged expired in the queue");
  const expiredReq = await makePending(laila.id, amal.id, yesterday);
  const todayReq = await makePending(laila.id, amal.id, today);
  const queue = await prisma.pickupPerson.findMany({
    where: { status: "PENDING", deletedAt: null, id: { in: created } },
    select: { id: true, expiresAt: true },
  });
  const expiredRow = queue.find((r) => r.id === expiredReq.id)!;
  const todayRow = queue.find((r) => r.id === todayReq.id)!;
  check("yesterday's date reads as expired", isExpired(expiredRow.expiresAt, now));
  check("today's date does NOT read as expired", !isExpired(todayRow.expiresAt, now));

  console.log("\n(1) An expired authorization drops off the board once approved");
  await approve(expiredReq.id, owner.id); // now APPROVED but expired
  await approve(todayReq.id, owner.id); // APPROVED and valid today
  const board = await activePeopleOnBoard(laila.id, now);
  const boardIds = board.map((p) => p.id);
  check("expired approved person is NOT on the board", !boardIds.includes(expiredReq.id));
  check("valid approved person IS on the board", boardIds.includes(todayReq.id));
  check(
    "isActivePickup agrees: expired approved is inactive",
    !isActivePickup({ status: "APPROVED", expiresAt: yesterday }, now),
  );

  console.log("\n(2) A stale second approval changes nothing");
  const dbl = await makePending(laila.id, amal.id, null);
  const first = await approve(dbl.id, owner.id);
  const second = await approve(dbl.id, owner.id);
  check("first approval changes 1 row", first.count === 1);
  check("second (stale) approval changes 0 rows", second.count === 0);

  console.log("\n(4) The pending count rises and falls with the queue");
  const base = await pendingCount();
  const a = await makePending(laila.id, amal.id, null);
  const b = await makePending(laila.id, amal.id, null);
  const afterAdd = await pendingCount();
  check("count rises by 2 after two new requests", afterAdd === base + 2);
  await approve(a.id, owner.id);
  await prisma.pickupPerson.updateMany({
    where: { id: b.id, status: "PENDING", deletedAt: null },
    data: { status: "REJECTED", reviewedByUserId: owner.id, reviewedAt: new Date() },
  });
  const afterClear = await pendingCount();
  check("count returns to baseline after approve + reject", afterClear === base);
}

main()
  .catch((error) => {
    console.error(error);
    failed++;
  })
  .finally(async () => {
    // Remove exactly the rows we created; the seeded state is left as it was.
    if (created.length > 0) {
      await prisma.pickupPerson.deleteMany({ where: { id: { in: created } } });
      console.log(`\nCleaned up ${created.length} temporary rows.`);
    }
    console.log(`\nResult: ${passed} passed, ${failed} failed.`);
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  });
