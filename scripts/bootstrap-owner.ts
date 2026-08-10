/**
 * Create the first owner account on an empty production database.
 *
 *   OWNER_EMAIL="..." OWNER_NAME="..." OWNER_PASSWORD="..." \
 *     npx tsx scripts/bootstrap-owner.ts
 *
 * WHY THIS EXISTS
 *
 * `prisma/seed.ts` is demo data — Sunflowers and Olives, Mariam and Yousef,
 * Laila and Omar and Zayn, all sharing one well-known password. It is exactly
 * what the authorization tests need and exactly what must never touch a real
 * nursery's database. But a freshly migrated production database has no users
 * at all, so without something like this there is no way to log in and no way
 * to invite anyone.
 *
 * This creates ONE account: the owner. Everyone else — teachers, parents — is
 * invited from inside the app, which is how staffing is meant to work anyway.
 *
 * SAFETY
 *
 * It refuses to run if any user already exists. That makes it a bootstrap
 * rather than a back door: it cannot be used to quietly add an owner to a
 * running system, and re-running it after launch does nothing.
 *
 * The password is read from the environment and never printed or logged.
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");
const { hash } = await import("@node-rs/argon2");

/** Algorithm.Argon2id — inlined; see the note in src/lib/auth/password.ts. */
const ARGON2ID = 2;

/** The app's own parameters. These must not drift from src/lib/auth/password.ts. */
const ARGON_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const MIN_PASSWORD_LENGTH = 12;

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
const name = process.env.OWNER_NAME?.trim();
const password = process.env.OWNER_PASSWORD;

if (!email) fail("OWNER_EMAIL is required.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  fail(`OWNER_EMAIL does not look like an email address: ${email}`);
}
if (!name) fail("OWNER_NAME is required — this is shown throughout the app.");
if (!password) fail("OWNER_PASSWORD is required.");
if (password.length < MIN_PASSWORD_LENGTH) {
  fail(`OWNER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}

/*
 * The demo password must never become a real one. It is committed in several
 * places in this repo and is the first thing anyone would try.
 */
if (password === "ChangeMe!Local123") {
  fail(
    "OWNER_PASSWORD is the demo password from the test fixtures. Choose a real one.",
  );
}
if (email.endsWith("@rihana.test")) {
  fail(
    "OWNER_EMAIL uses the @rihana.test demo domain. Use the nursery's real address.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const existing = await prisma.user.count();

  if (existing > 0) {
    fail(
      `This database already has ${existing} user(s), so it is not empty.\n` +
        "  This script only bootstraps a fresh install. To add staff, use the\n" +
        "  invitation flow inside the app.",
    );
  }

  const passwordHash = await hash(password!, ARGON_OPTIONS);

  const owner = await prisma.user.create({
    data: {
      email: email!,
      name: name!,
      role: "OWNER",
      status: "ACTIVE",
      passwordHash,
    },
    select: { id: true, email: true, name: true },
  });

  console.log("\n  Owner account created.\n");
  console.log(`    name   ${owner.name}`);
  console.log(`    email  ${owner.email}`);
  console.log("    password  (the one you supplied — not shown)\n");
  console.log("  Sign in, then invite staff from Parents & staff.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
