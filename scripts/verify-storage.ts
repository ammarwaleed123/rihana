/**
 * Storage round-trip check.
 *
 * Proves the S3 credentials work end to end — upload, signed URL, download,
 * delete — and that the bucket is genuinely private. Never prints a credential:
 * only whether each step succeeded.
 *
 *   npx tsx scripts/verify-storage.ts
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} = await import("@aws-sdk/client-s3");
const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION;
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

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

console.log("\nStorage configuration");
check("STORAGE_DRIVER is s3", process.env.STORAGE_DRIVER === "s3", `got "${process.env.STORAGE_DRIVER}"`);
check("S3_ENDPOINT set", Boolean(endpoint));
check("S3_REGION set", Boolean(region));
check("S3_BUCKET set", Boolean(bucket));
// Presence only — the values are never printed.
check("S3_ACCESS_KEY_ID set", Boolean(accessKeyId));
check("S3_SECRET_ACCESS_KEY set", Boolean(secretAccessKey));

if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
  console.log("\nMissing configuration — stopping before network calls.\n");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
});

const key = `_verify/${Date.now()}-roundtrip.txt`;
const body = `rihana storage check ${new Date().toISOString()}`;

console.log("\nRound trip");

try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  check("bucket is reachable with these credentials", true);
} catch (error) {
  check(
    "bucket is reachable with these credentials",
    false,
    (error as Error).name,
  );
  console.log("\nStopping — cannot reach the bucket.\n");
  process.exit(1);
}

try {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    }),
  );
  check("upload succeeds", true);
} catch (error) {
  check("upload succeeds", false, (error as Error).name);
}

let signedUrl = "";
try {
  signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 },
  );
  check("signed URL can be generated", signedUrl.length > 0);
} catch (error) {
  check("signed URL can be generated", false, (error as Error).name);
}

if (signedUrl) {
  const response = await fetch(signedUrl);
  const text = await response.text();
  check(
    "signed URL returns the object",
    response.ok && text === body,
    `status ${response.status}`,
  );
}

// The security-critical assertion: without a signature, the object must not be
// readable. If this passes, the bucket is public and photos would be exposed.
const publicUrl = `${endpoint.replace(/\/s3$/, "")}/object/public/${bucket}/${key}`;
try {
  const response = await fetch(publicUrl);
  check(
    "object is NOT readable without a signature (bucket is private)",
    !response.ok,
    response.ok ? "bucket appears PUBLIC — fix this before uploading photos" : "",
  );
} catch {
  check("object is NOT readable without a signature (bucket is private)", true);
}

// Anonymous listing must also fail.
try {
  const response = await fetch(`${endpoint}/${bucket}`);
  check(
    "bucket is not anonymously listable",
    !response.ok || response.status === 403,
    `status ${response.status}`,
  );
} catch {
  check("bucket is not anonymously listable", true);
}

try {
  await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
  check("authenticated listing works (needed for cleanup jobs)", true);
} catch (error) {
  check(
    "authenticated listing works (needed for cleanup jobs)",
    false,
    (error as Error).name,
  );
}

try {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  check("delete succeeds (needed for the data-erasure path)", true);
} catch (error) {
  check("delete succeeds (needed for the data-erasure path)", false, (error as Error).name);
}

if (signedUrl) {
  const response = await fetch(signedUrl);
  check("deleted object is gone", !response.ok, `status ${response.status}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
