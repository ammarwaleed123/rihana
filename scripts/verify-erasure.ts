/**
 * Does "delete this child" actually erase them?
 *
 * The rows were never the hard part. The question is whether the FILES leave
 * object storage — which is what a family asking to be erased means, and what
 * the audit log claims happened.
 *
 * For a long time the answer was no. `deleteChild` returned the ids of the
 * photos it had orphaned and the caller logged "storage purge pending queue
 * wiring"; the images stayed in the bucket indefinitely while the database, the
 * interface and the audit trail all reported them destroyed. The ordering is the
 * trap — the rows holding the storage keys are deleted inside the same
 * transaction, so a caller handed only ids has nothing left to resolve.
 *
 * Three kinds of object belong to a child and all must go: the photos that
 * showed only them, the avatars of the people authorized to collect them, and
 * the handwritten signatures on their accident records — the teacher's and the
 * family's alike.
 *
 * The deletion is driven through the REAL admin screen rather than by calling
 * the data layer, because the bug was in the action's wiring and not in the
 * query. Setup and verification talk to Postgres and S3 directly. Everything it
 * creates is removed again, however it exits.
 *
 *   npx tsx --env-file=.env.local scripts/verify-erasure.ts
 *
 * Needs the app running (VERIFY_BASE_URL, default http://localhost:3120) and a
 * worker consuming the queue — the purge is a job, not part of the request.
 */

import { randomBytes } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { chromium } = await import("@playwright/test");
const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3120";
const PASSWORD = process.env.VERIFY_PASSWORD ?? "ChangeMe!Local123";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/*
 * Read and write objects the way the app under test does.
 *
 * This used to talk to S3 unconditionally. Development runs on the local
 * driver, so every object the script placed sat in a bucket the app never
 * touched and the run reported four failures that said nothing about the code —
 * the worst kind of security check, because the honest reading of a red result
 * is "something is broken" and here it never was.
 */
const DRIVER = process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
const LOCAL_ROOT = resolve(process.cwd(), ".storage");

type Objects = {
  put(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  removeAll(keys: string[]): Promise<void>;
};

async function s3Objects(): Promise<Objects> {
  const {
    DeleteObjectsCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
  } = await import("@aws-sdk/client-s3");

  const Bucket = process.env.S3_BUCKET!;
  const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  return {
    async put(Key) {
      await client.send(
        new PutObjectCommand({ Bucket, Key, Body: randomBytes(512) }),
      );
    },
    async exists(Key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key }));
        return true;
      } catch {
        return false;
      }
    },
    async removeAll(keys) {
      if (keys.length === 0) return;
      await client
        .send(
          new DeleteObjectsCommand({
            Bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        )
        .catch(() => {});
    },
  };
}

const localObjects: Objects = {
  async put(key) {
    const path = resolve(LOCAL_ROOT, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, randomBytes(512));
  },
  async exists(key) {
    try {
      await stat(resolve(LOCAL_ROOT, key));
      return true;
    } catch {
      return false;
    }
  },
  async removeAll(keys) {
    for (const key of keys) {
      await rm(resolve(LOCAL_ROOT, key), { force: true }).catch(() => {});
    }
  },
};

const objects: Objects = DRIVER === "s3" ? await s3Objects() : localObjects;

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function exists(key: string): Promise<boolean> {
  return objects.exists(key);
}

/** The purge is queued, so give the worker a moment rather than racing it. */
async function waitGone(keys: string[], ms = 20_000): Promise<string[]> {
  const deadline = Date.now() + ms;
  for (;;) {
    const left: string[] = [];
    for (const key of keys) if (await exists(key)) left.push(key);
    if (left.length === 0 || Date.now() > deadline) return left;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  const parent = await prisma.user.findFirstOrThrow({ where: { role: "PARENT" } });
  const klass = await prisma.class.findFirstOrThrow();

  const stamp = Date.now().toString().slice(-9);
  const last = `Erasure${stamp}`;
  const fullName = `Probe ${last}`;

  const child = await prisma.child.create({
    data: {
      firstName: "Probe",
      lastName: last,
      dateOfBirth: new Date("2023-01-01"),
      classId: klass.id,
      photoConsent: true,
    },
    select: { id: true },
  });

  const upload = await prisma.uploadSession.create({
    data: { classId: klass.id, uploaderUserId: owner.id, status: "PUBLISHED" },
    select: { id: true },
  });

  const photoKeys = [
    `verify-erasure/${stamp}/original.jpg`,
    `verify-erasure/${stamp}/web.jpg`,
    `verify-erasure/${stamp}/thumb.jpg`,
  ];
  const avatarKeys = [
    `verify-erasure/${stamp}/avatar.jpg`,
    `verify-erasure/${stamp}/avatar-thumb.jpg`,
  ];
  /*
   * The handwritten signatures on an accident record — the teacher's and the
   * family's. Exactly the same trap as the photographs: the rows cascade away
   * with the child, so unless the keys are read before the delete, two drawn
   * signatures of named people stay in the bucket after the family has been
   * told the record was permanently destroyed.
   */
  const signatureKeys = [
    `verify-erasure/${stamp}/sig-teacher.jpg`,
    `verify-erasure/${stamp}/sig-parent.jpg`,
  ];
  const all = [...photoKeys, ...avatarKeys, ...signatureKeys];

  for (const key of all) {
    await objects.put(key);
  }

  const photo = await prisma.photo.create({
    data: {
      uploadSessionId: upload.id,
      classId: klass.id,
      uploadedByUserId: owner.id,
      status: "READY",
      visibility: "TAGGED_ONLY",
      storageKeyOriginal: photoKeys[0],
      storageKeyWeb: photoKeys[1],
      storageKeyThumb: photoKeys[2],
      mimeType: "image/jpeg",
      byteSize: 512,
      checksumSha256: randomBytes(32).toString("hex"),
      publishedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.photoTag.create({
    data: {
      photoId: photo.id,
      childId: child.id,
      taggedByUserId: owner.id,
      photoCreatedAt: new Date(),
    },
  });

  await prisma.pickupPerson.create({
    data: {
      childId: child.id,
      addedByUserId: owner.id,
      fullName: "Probe Collector",
      relationship: "Aunt",
      phone: "01000000000",
      status: "APPROVED",
      photoStorageKey: avatarKeys[0],
      photoThumbKey: avatarKeys[1],
    },
  });

  const accident = await prisma.accidentReport.create({
    data: { childId: child.id, date: new Date("2026-01-05"), classId: klass.id },
    select: { id: true },
  });

  const incident = await prisma.accidentIncident.create({
    data: {
      reportId: accident.id,
      timeOfIncident: "10:15",
      place: "GARDEN",
      figure: "GIRL",
      bodyParts: ["KNEE"],
      nature: ["SCRATCH"],
      treatment: ["RUNNING_WATER"],
      description: "Probe record for the erasure check.",
      signatureStorageKey: signatureKeys[0]!,
      signedByUserId: owner.id,
    },
    select: { id: true },
  });

  await prisma.accidentAcknowledgement.create({
    data: {
      incidentId: incident.id,
      userId: parent.id,
      signatureStorageKey: signatureKeys[1]!,
    },
  });

  console.log(`\nErasure (against ${BASE}, storage driver: ${DRIVER})`);
  console.log(`  set up ${all.length} objects for a throwaway child\n`);

  const browser = await chromium.launch();

  try {
    for (const key of all) {
      if (!(await exists(key))) throw new Error(`setup failed: ${key} missing`);
    }

    const page = await browser.newPage();
    await page.goto(`${BASE}/signin`);
    await page.getByLabel("Email").fill(owner.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin/);

    await page.goto(`${BASE}/admin/children/${child.id}`);
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page
      .getByLabel(new RegExp(`Type .${fullName}. to confirm`))
      .fill(fullName);
    await page
      .getByRole("button", { name: `Permanently delete ${fullName}` })
      .click();
    await page.waitForURL(/\/admin\/children\?deleted=/);

    check(
      "the child record is gone",
      (await prisma.child.findUnique({ where: { id: child.id } })) === null,
    );

    const survivors = await waitGone(all);
    check(
      "every object belonging to the erased child leaves the bucket",
      survivors.length === 0,
      survivors.length ? `left behind: ${survivors.join(", ")}` : "",
    );

    const photoLeft = photoKeys.filter((k) => survivors.includes(k));
    const avatarLeft = avatarKeys.filter((k) => survivors.includes(k));
    const signaturesLeft = signatureKeys.filter((k) => survivors.includes(k));
    check("…their photographs", photoLeft.length === 0);
    check("…their pickup people's avatars", avatarLeft.length === 0);
    check(
      "…and the signatures on their accident records",
      signaturesLeft.length === 0,
    );

    check(
      "the accident record itself is gone",
      (await prisma.accidentReport.findUnique({ where: { id: accident.id } })) ===
        null,
    );
  } finally {
    await browser.close();
    await objects.removeAll(all);
    await prisma.accidentReport.deleteMany({ where: { childId: child.id } });
    await prisma.photoTag.deleteMany({ where: { childId: child.id } });
    await prisma.pickupPerson.deleteMany({ where: { childId: child.id } });
    await prisma.photo.deleteMany({ where: { uploadSessionId: upload.id } });
    await prisma.uploadSession.deleteMany({ where: { id: upload.id } });
    await prisma.child.deleteMany({ where: { id: child.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
