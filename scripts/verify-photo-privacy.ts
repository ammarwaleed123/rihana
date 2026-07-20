/**
 * Verify privacy guarantees against photos that are actually in storage.
 *
 * The unit tests prove the processing function strips metadata. This proves the
 * bytes sitting in the bucket right now have none — which is the claim that
 * actually matters to a family.
 *
 *   npx tsx scripts/verify-photo-privacy.ts
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");
const sharp = (await import("sharp")).default;
const {
  S3Client,
  GetObjectCommand,
} = await import("@aws-sdk/client-s3");

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
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

async function fetchObject(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
  );
  return Buffer.from((await response.Body!.transformToByteArray()) as Uint8Array);
}

const photos = await prisma.photo.findMany({
  where: { deletedAt: null },
  take: 10,
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    storageKeyOriginal: true,
    storageKeyWeb: true,
    storageKeyThumb: true,
    status: true,
    mimeType: true,
  },
});

console.log(`\nInspecting ${photos.length} stored photo(s)\n`);

if (photos.length === 0) {
  console.log("No photos in the database — upload some first.\n");
  await prisma.$disconnect();
  process.exit(0);
}

for (const photo of photos) {
  const keys = [
    photo.storageKeyOriginal,
    photo.storageKeyWeb,
    photo.storageKeyThumb,
  ].filter((k): k is string => Boolean(k));

  for (const key of keys) {
    const variant = key.split("/").pop();

    try {
      const bytes = await fetchObject(key);
      const meta = await sharp(bytes).metadata();
      const asText = bytes.toString("latin1");

      check(
        `${photo.id.slice(0, 8)}/${variant}: no EXIF`,
        !meta.exif,
        "EXIF present in a stored object",
      );
      check(
        `${photo.id.slice(0, 8)}/${variant}: no GPS markers in raw bytes`,
        !asText.includes("GPSLatitude") && !asText.includes("GPSLongitude"),
      );
      check(
        `${photo.id.slice(0, 8)}/${variant}: no XMP/IPTC`,
        !meta.xmp && !meta.iptc,
      );
      check(
        `${photo.id.slice(0, 8)}/${variant}: stored as JPEG`,
        meta.format === "jpeg",
        `got ${meta.format}`,
      );
    } catch (error) {
      check(
        `${photo.id.slice(0, 8)}/${variant}: readable from storage`,
        false,
        (error as Error).name,
      );
    }
  }
}

// Every READY photo must have all three variants, or the album shows gaps.
const incomplete = photos.filter(
  (p) => p.status === "READY" && (!p.storageKeyWeb || !p.storageKeyThumb),
);
check(
  "every READY photo has web and thumbnail variants",
  incomplete.length === 0,
  `${incomplete.length} incomplete`,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;

await prisma.$disconnect();
