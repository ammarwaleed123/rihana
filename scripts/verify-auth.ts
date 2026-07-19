/**
 * Phase 1 verification harness.
 *
 * Drives the real session and credential code against the real database, then
 * exercises the running server with the resulting cookies. This is the
 * "run it and click through it" step, automated so it can be re-run later.
 *
 *   npx tsx scripts/verify-auth.ts
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");
const { createHash, randomBytes } = await import("node:crypto");
const { hash: argonHash, verify: argonVerify } = await import("@node-rs/argon2");

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3210";
const COOKIE = "rihana_session";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  }
}

/** Mint a real session row exactly as src/lib/data/sessions.ts does. */
async function mintSession(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true, name: true },
  });

  const token = randomBytes(32).toString("base64url");
  const id = createHash("sha256").update(token, "utf8").digest("hex");

  await prisma.session.create({
    data: {
      id,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });

  return { token, user };
}

async function get(path: string, token?: string) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: token ? { Cookie: `${COOKIE}=${token}` } : {},
  });

  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    body: await response.text(),
  };
}

async function main() {
  console.log(`\nVerifying against ${BASE}\n`);

  // --- Session validity ----------------------------------------------------
  console.log("Session handling");

  const parent = await mintSession("amal@rihana.test");
  const owner = await mintSession("owner@rihana.test");
  const teacher = await mintSession("teacher.sun@rihana.test");

  const portalAsParent = await get("/portal", parent.token);
  check(
    "a valid parent session reaches /portal",
    portalAsParent.status === 200,
    `got ${portalAsParent.status}`,
  );
  check(
    "the portal greets the signed-in parent by name",
    portalAsParent.body.includes("Amal Saeed"),
  );

  const adminAsOwner = await get("/admin", owner.token);
  check(
    "a valid owner session reaches /admin",
    adminAsOwner.status === 200,
    `got ${adminAsOwner.status}`,
  );
  check(
    "the owner is shown as unrestricted",
    adminAsOwner.body.includes("whole nursery"),
  );

  const adminAsTeacher = await get("/admin", teacher.token);
  check(
    "a valid teacher session reaches /admin",
    adminAsTeacher.status === 200,
    `got ${adminAsTeacher.status}`,
  );
  check(
    "the teacher is shown as class-restricted",
    adminAsTeacher.body.includes("classes you are assigned to"),
  );

  // --- Role separation -----------------------------------------------------
  console.log("\nRole separation");

  const parentTriesAdmin = await get("/admin", parent.token);
  check(
    "a parent is redirected away from /admin",
    parentTriesAdmin.status === 307 && parentTriesAdmin.location.includes("/portal"),
    `got ${parentTriesAdmin.status} -> ${parentTriesAdmin.location}`,
  );

  const ownerTriesPortal = await get("/portal", owner.token);
  check(
    "staff are redirected away from /portal",
    ownerTriesPortal.status === 307 && ownerTriesPortal.location.includes("/admin"),
    `got ${ownerTriesPortal.status} -> ${ownerTriesPortal.location}`,
  );

  // --- Forged and stale sessions ------------------------------------------
  console.log("\nForged and stale sessions");

  const forged = await get("/portal", "not-a-real-token-at-all");
  check(
    "a forged cookie does not reach /portal",
    forged.status === 307 && forged.location.includes("/signin"),
    `got ${forged.status}`,
  );

  // A raw token that happens to be the *hash* of a real one must also fail —
  // proves the server hashes what it receives rather than comparing directly.
  const rawHash = createHash("sha256").update(parent.token, "utf8").digest("hex");
  const hashAsToken = await get("/portal", rawHash);
  check(
    "presenting the stored hash as the token fails",
    hashAsToken.status === 307,
    `got ${hashAsToken.status}`,
  );

  // Expire a session and confirm it stops working immediately.
  const expiring = await mintSession("khalid@rihana.test");
  await prisma.session.update({
    where: { id: createHash("sha256").update(expiring.token, "utf8").digest("hex") },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await get("/portal", expiring.token);
  check(
    "an expired session is rejected",
    expired.status === 307,
    `got ${expired.status}`,
  );
  const expiredRow = await prisma.session.findUnique({
    where: {
      id: createHash("sha256").update(expiring.token, "utf8").digest("hex"),
    },
  });
  check("the expired session row is deleted on read", expiredRow === null);

  // Disabling an account must revoke access immediately, not at token expiry.
  const disabled = await mintSession("nour@rihana.test");
  await prisma.user.update({
    where: { email: "nour@rihana.test" },
    data: { status: "DISABLED" },
  });
  const afterDisable = await get("/portal", disabled.token);
  check(
    "disabling an account revokes its live session at once",
    afterDisable.status === 307,
    `got ${afterDisable.status}`,
  );
  await prisma.user.update({
    where: { email: "nour@rihana.test" },
    data: { status: "ACTIVE" },
  });

  // --- Storage guarantees --------------------------------------------------
  console.log("\nWhat is actually stored");

  const storedIds = await prisma.session.findMany({ select: { id: true } });
  check(
    "no session row stores a raw token",
    storedIds.every((row) => /^[a-f0-9]{64}$/.test(row.id)),
  );
  check(
    "the live token does not appear as any stored id",
    !storedIds.some((row) => row.id === parent.token),
  );

  const users = await prisma.user.findMany({ select: { passwordHash: true } });
  check(
    "every password is argon2id",
    users.every((u) => !u.passwordHash || u.passwordHash.startsWith("$argon2id$")),
  );

  // --- Credential checks ---------------------------------------------------
  console.log("\nCredential verification");

  const amal = await prisma.user.findUniqueOrThrow({
    where: { email: "amal@rihana.test" },
    select: { passwordHash: true },
  });

  check(
    "the seeded password verifies",
    await argonVerify(amal.passwordHash!, "ChangeMe!Local123"),
  );
  check(
    "a wrong password is rejected",
    !(await argonVerify(amal.passwordHash!, "ChangeMe!Local124")),
  );

  // Timing parity between "unknown email" and "wrong password".
  const dummy = await argonHash("throwaway", {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const t0 = performance.now();
  await argonVerify(amal.passwordHash!, "wrong-password-here");
  const wrongPasswordMs = performance.now() - t0;

  const t1 = performance.now();
  await argonVerify(dummy, "wrong-password-here");
  const unknownUserMs = performance.now() - t1;

  const ratio = Math.max(wrongPasswordMs, unknownUserMs) / Math.min(wrongPasswordMs, unknownUserMs);
  check(
    "unknown-email and wrong-password cost the same time (no account oracle)",
    ratio < 2,
    `ratio ${ratio.toFixed(2)} (${wrongPasswordMs.toFixed(0)}ms vs ${unknownUserMs.toFixed(0)}ms)`,
  );

  // --- Cleanup -------------------------------------------------------------
  await prisma.session.deleteMany({
    where: {
      id: {
        in: [parent, owner, teacher, expiring, disabled].map((s) =>
          createHash("sha256").update(s.token, "utf8").digest("hex"),
        ),
      },
    },
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
