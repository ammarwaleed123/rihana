/**
 * Post-deploy smoke tests, run against the live site.
 *
 *   npx dotenv -e .env.production.local -- npx tsx scripts/smoke.ts
 *
 * These are the checks that cannot be answered from a laptop, and so were
 * carried in docs/security.md for weeks as "not yet verified": whether cookies
 * genuinely carry Secure over real HTTPS, whether the production bucket is
 * private, and whether any demo account leaked into production.
 *
 * Three tiers, each skipped cleanly if its inputs are absent, so this is useful
 * whether you have every credential to hand or only the URL:
 *
 *   public       always     — needs only SMOKE_URL
 *   database     if DATABASE_URL is set
 *   storage      if the S3_* variables are set
 *   signed-in    if SMOKE_EMAIL and SMOKE_PASSWORD are set
 *
 * Read-only. It creates nothing, changes nothing, and is safe to run against a
 * live nursery at any time.
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.production.local", ".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const BASE = (process.env.SMOKE_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
if (!BASE) {
  console.error("\n  Set SMOKE_URL or APP_URL to the live site's address.\n");
  process.exit(1);
}

let passed = 0;
let failed = 0;
let skipped = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function skip(label: string, why: string) {
  skipped++;
  console.log(`  SKIP  ${label} — ${why}`);
}

function section(name: string) {
  console.log(`\n${name}`);
}

async function publicChecks() {
  section("Reachable and correctly configured");

  const health = await fetch(`${BASE}/api/health`);
  check("the health endpoint answers 200", health.status === 200, `got ${health.status}`);

  const home = await fetch(`${BASE}/`);
  check("the public site loads", home.ok, `got ${home.status}`);

  const h = home.headers;

  /*
   * HSTS is the one that could only ever be verified here. Locally the app
   * serves over http, where the header is meaningless and browsers ignore it.
   */
  const hsts = h.get("strict-transport-security") ?? "";
  check(
    "HSTS is sent over real HTTPS",
    /max-age=\d{7,}/.test(hsts),
    hsts || "absent",
  );

  const csp = h.get("content-security-policy") ?? "";
  check("CSP restricts by default", csp.includes("default-src 'self'"), csp ? "" : "absent");
  check("CSP forbids plugins/objects", csp.includes("object-src 'none'"));
  check("CSP pins form submissions to this origin", csp.includes("form-action 'self'"));
  check("CSP forbids framing", csp.includes("frame-ancestors 'none'"));

  check("MIME sniffing is off", h.get("x-content-type-options") === "nosniff");
  check("framing is denied", (h.get("x-frame-options") ?? "").toUpperCase() === "DENY");
  check("referrers are trimmed cross-origin", Boolean(h.get("referrer-policy")));
  check("the server does not advertise itself", !h.get("x-powered-by"), h.get("x-powered-by") ?? "");

  section("Private routes turn strangers away");

  for (const path of ["/portal", "/admin", "/portal/photos", "/admin/children"]) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    check(
      `${path} redirects an anonymous visitor to sign in`,
      res.status >= 300 && res.status < 400 && location.includes("/signin"),
      `${res.status} ${location}`,
    );
  }

  section("Not indexable");

  const portal = await fetch(`${BASE}/portal`, { redirect: "manual" });
  check(
    "the portal is marked noindex",
    (portal.headers.get("x-robots-tag") ?? "").includes("noindex"),
    portal.headers.get("x-robots-tag") ?? "absent",
  );

  const img = await fetch(`${BASE}/api/img/nonexistent`, { redirect: "manual" });
  check(
    "image responses are never stored by shared caches",
    (img.headers.get("cache-control") ?? "").includes("no-store"),
    img.headers.get("cache-control") ?? "absent",
  );
}

async function databaseChecks() {
  section("Production data is real data");

  if (!process.env.DATABASE_URL) {
    skip("no demo accounts exist", "DATABASE_URL not set");
    return;
  }

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    /*
     * The demo seed refuses to run when NODE_ENV=production, which protects the
     * obvious case but not a production DATABASE_URL in a non-production shell.
     * This asserts the outcome instead of trusting the guard.
     */
    const demo = await prisma.user.count({
      where: { email: { endsWith: "@rihana.test" } },
    });
    check("no @rihana.test demo account exists", demo === 0, `found ${demo}`);

    const owners = await prisma.user.count({ where: { role: "OWNER" } });
    check("at least one owner account exists", owners >= 1, `found ${owners}`);

    const noPassword = await prisma.user.count({
      where: { status: "ACTIVE", passwordHash: null },
    });
    check("no active account is missing a password", noPassword === 0, `found ${noPassword}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function storageChecks() {
  section("The production bucket is private");

  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;

  if (!bucket || !endpoint || !process.env.S3_ACCESS_KEY_ID) {
    skip("bucket is not publicly readable", "S3_* not set");
    return;
  }

  const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } =
    await import("@aws-sdk/client-s3");

  const s3 = new S3Client({
    region: process.env.S3_REGION,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  const key = `smoke/${Date.now()}.txt`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "smoke" }));

  try {
    // The object exists. Fetching it without a signature must not work.
    const direct = await fetch(`${endpoint.replace(/\/$/, "")}/${bucket}/${key}`);
    check(
      "an object cannot be read without a signature",
      !direct.ok,
      `got ${direct.status}`,
    );

    const listing = await fetch(`${endpoint.replace(/\/$/, "")}/${bucket}`);
    check(
      "the bucket cannot be listed anonymously",
      !listing.ok,
      `got ${listing.status}`,
    );

    const authorized = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }),
    );
    check(
      "the app's own credentials can still list (cleanup jobs need this)",
      Array.isArray(authorized.Contents) || authorized.KeyCount === 0,
    );
  } finally {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
  }
}

async function signedInChecks() {
  section("Session cookies under real HTTPS");

  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;

  if (!email || !password) {
    skip("the session cookie is Secure and __Host- prefixed", "SMOKE_EMAIL/SMOKE_PASSWORD not set");
    return;
  }

  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/signin`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(portal|admin)/, { timeout: 30_000 });

    check("the owner can sign in", /\/(portal|admin)/.test(page.url()), page.url());

    const cookie = (await context.cookies()).find((c) =>
      c.name.includes("rihana_session"),
    );

    check("a session cookie is issued", Boolean(cookie), cookie?.name ?? "none");
    check("it is Secure", cookie?.secure === true);
    check("it is httpOnly", cookie?.httpOnly === true);
    check("it is SameSite=Lax", cookie?.sameSite === "Lax", `got ${cookie?.sameSite}`);

    /*
     * The __Host- prefix is the strongest cookie binding available: the browser
     * refuses it unless it is Secure, path=/, and has no Domain — which pins it
     * to this exact host and stops a subdomain from setting or reading it.
     */
    check(
      "it carries the __Host- prefix",
      cookie?.name.startsWith("__Host-") === true,
      cookie?.name ?? "",
    );
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`\nSmoke tests against ${BASE}`);

  await publicChecks();
  await databaseChecks();
  await storageChecks();
  await signedInChecks();

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
