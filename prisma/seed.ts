import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");
const { hash } = await import("@node-rs/argon2");

/** Algorithm.Argon2id — inlined; see the note in src/lib/auth/password.ts. */
const ARGON2ID = 2;

/**
 * Demo data.
 *
 * Grows with each phase. Phase 1 seeds accounts and the class/child/guardianship
 * graph, because the authorization rules cannot be exercised without it:
 * verifying that one parent cannot see another's child requires two parents and
 * two children that actually exist.
 *
 * Idempotent — safe to re-run. Uses upserts keyed on natural identifiers.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_PASSWORD = process.env.SEED_OWNER_PASSWORD || "ChangeMe!Local123";

function hashPassword(password: string) {
  return hash(password, {
    algorithm: ARGON2ID,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function main() {
  console.log("[seed] starting");

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // --- Classes -------------------------------------------------------------
  const sunflowers = await prisma.class.upsert({
    where: { slug: "sunflowers" },
    update: {},
    create: {
      name: "Sunflowers",
      slug: "sunflowers",
      ageGroupKey: "toddlers",
      academicYear: "2026-2027",
    },
  });

  const olives = await prisma.class.upsert({
    where: { slug: "olives" },
    update: {},
    create: {
      name: "Olives",
      slug: "olives",
      ageGroupKey: "preschool",
      academicYear: "2026-2027",
    },
  });

  // --- Staff ---------------------------------------------------------------
  const owner = await prisma.user.upsert({
    where: { email: (process.env.SEED_OWNER_EMAIL || "owner@rihana.test").toLowerCase() },
    update: {},
    create: {
      email: (process.env.SEED_OWNER_EMAIL || "owner@rihana.test").toLowerCase(),
      name: "Rihana Owner",
      role: "OWNER",
      status: "ACTIVE",
      passwordHash,
    },
  });

  const teacherSun = await prisma.user.upsert({
    where: { email: "teacher.sun@rihana.test" },
    update: {},
    create: {
      email: "teacher.sun@rihana.test",
      name: "Mariam Haddad",
      role: "TEACHER",
      status: "ACTIVE",
      passwordHash,
    },
  });

  const teacherOlive = await prisma.user.upsert({
    where: { email: "teacher.olive@rihana.test" },
    update: {},
    create: {
      email: "teacher.olive@rihana.test",
      name: "Yousef Nasser",
      role: "TEACHER",
      status: "ACTIVE",
      passwordHash,
    },
  });

  // Each teacher is assigned to exactly one class — this is what makes
  // "a teacher cannot reach another class" testable.
  await prisma.teacherAssignment.upsert({
    where: { userId_classId: { userId: teacherSun.id, classId: sunflowers.id } },
    update: {},
    create: { userId: teacherSun.id, classId: sunflowers.id },
  });

  await prisma.teacherAssignment.upsert({
    where: { userId_classId: { userId: teacherOlive.id, classId: olives.id } },
    update: {},
    create: { userId: teacherOlive.id, classId: olives.id },
  });

  // --- Parents and children ------------------------------------------------
  const parentSpecs = [
    { email: "amal@rihana.test", name: "Amal Saeed" },
    { email: "khalid@rihana.test", name: "Khalid Rahman" },
    { email: "nour@rihana.test", name: "Nour Aziz" },
    { email: "sami@rihana.test", name: "Sami Darwish" },
  ];

  const parents = [];
  for (const spec of parentSpecs) {
    parents.push(
      await prisma.user.upsert({
        where: { email: spec.email },
        update: {},
        create: {
          email: spec.email,
          name: spec.name,
          role: "PARENT",
          status: "ACTIVE",
          passwordHash,
        },
      }),
    );
  }

  const childSpecs = [
    { first: "Laila", last: "Saeed", classId: sunflowers.id, dob: "2023-04-12", guardians: [0] },
    { first: "Omar", last: "Saeed", classId: olives.id, dob: "2021-09-02", guardians: [0] },
    { first: "Zayn", last: "Rahman", classId: sunflowers.id, dob: "2023-01-25", guardians: [1] },
    { first: "Hana", last: "Aziz", classId: olives.id, dob: "2021-11-30", guardians: [2] },
    // Two guardians on one child — exercises the many-to-many properly.
    { first: "Tariq", last: "Darwish", classId: sunflowers.id, dob: "2022-12-08", guardians: [3, 2] },
    { first: "Maya", last: "Darwish", classId: olives.id, dob: "2021-06-19", guardians: [3] },
  ];

  for (const spec of childSpecs) {
    const existing = await prisma.child.findFirst({
      where: { firstName: spec.first, lastName: spec.last },
      select: { id: true },
    });

    const child =
      existing ??
      (await prisma.child.create({
        data: {
          firstName: spec.first,
          lastName: spec.last,
          dateOfBirth: new Date(spec.dob),
          classId: spec.classId,
          status: "ACTIVE",
          photoConsent: true,
        },
      }));

    for (const [index, parentIndex] of spec.guardians.entries()) {
      await prisma.guardianship.upsert({
        where: {
          parentUserId_childId: {
            parentUserId: parents[parentIndex]!.id,
            childId: child.id,
          },
        },
        update: {},
        create: {
          parentUserId: parents[parentIndex]!.id,
          childId: child.id,
          relationship: index === 0 ? "MOTHER" : "FATHER",
          isPrimary: index === 0,
        },
      });
    }
  }

  console.log(`[seed] done.

  Sign in at /signin with password: ${DEMO_PASSWORD}

    owner                  ${owner.email}
    teacher (Sunflowers)   ${teacherSun.email}
    teacher (Olives)       ${teacherOlive.email}
    parents                ${parentSpecs.map((p) => p.email).join("\n                           ")}

  Amal has two children in different classes; Nour and Sami share Tariq.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
