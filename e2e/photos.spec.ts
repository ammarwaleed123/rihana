import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Phase 3: photo upload, tagging, and the routing rule end to end.
 *
 * The routing rule is unit-tested in tests/photo-routing.test.ts. These prove
 * the other half: that the rule is actually applied on every path a real
 * browser can reach, including the raw image route.
 */

const PASSWORD = "ChangeMe!Local123";
const OWNER = "owner@rihana.test";
const TEACHER_SUN = "teacher.sun@rihana.test";

// Amal has Laila (Sunflowers) and Omar (Olives).
const PARENT_AMAL = "amal@rihana.test";
// Khalid has Zayn (Sunflowers) only — the second family used for IDOR checks.
const PARENT_KHALID = "khalid@rihana.test";

/*
 * Serial, and with a generous timeout.
 *
 * These are the only tests that do real image processing and real round trips
 * to object storage in another region — a two-photo upload alone is four
 * uploads plus two sharp encodes. The default 30s budget is for tests that talk
 * to a local server; it is not a meaningful signal here, and treating it as one
 * just produces flakes.
 */
test.describe.configure({ mode: "serial", timeout: 180_000 });

const fixtures = join(tmpdir(), "rihana-e2e-photos");
mkdirSync(fixtures, { recursive: true });

async function makePhoto(name: string, colour: string): Promise<string> {
  const path = join(fixtures, name);
  const buffer = await sharp({
    create: { width: 900, height: 700, channels: 3, background: colour },
  })
    .jpeg()
    .toBuffer();

  writeFileSync(path, buffer);
  return path;
}

async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(portal|admin)/);
}

function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

/** Upload photos into a class and land on the tagging screen. */
async function uploadInto(page: Page, className: string, paths: string[]) {
  await page.goto("/admin/photos");
  await page.getByLabel("Class").selectOption({ label: className });
  await page.getByLabel("Photos").setInputFiles(paths);
  await page.getByRole("button", { name: /^Upload \d+ photo/ }).click();
  await page.waitForURL(/\/admin\/photos\/[a-z0-9]+/);
  return page.url().split("/").pop()!;
}

test.describe("upload and tagging", () => {
  test("a teacher uploads into their own class and tags a child", async ({
    page,
  }) => {
    const photo = await makePhoto("sun-1.jpg", "#3E7C4F");

    await signIn(page, TEACHER_SUN);
    await uploadInto(page, "Sunflowers", [photo]);

    // Untagged photos are flagged, because they would reach nobody.
    await expect(
      visibleText(page, "Nobody is tagged, so no family will see this"),
    ).toBeVisible();

    // Only Sunflowers children are offered as tag options.
    await expect(page.getByText("Laila", { exact: true })).toBeVisible();
    await expect(page.getByText("Hana", { exact: true })).toHaveCount(0);

    await page.getByText("Laila", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();

    await expect(visibleText(page, "Tags saved")).toBeVisible();
  });

  test("a non-image file is rejected by content, not by name", async ({
    page,
  }) => {
    // Named .jpg, but the bytes are plain text.
    //
    // Deliberately innocuous text rather than a webshell or an MZ header:
    // Windows Defender inspects outbound request bodies and silently kills the
    // connection when it sees a malware signature, which fails the request at
    // the network layer before it ever reaches the server — an AV false
    // positive masquerading as an application bug. The malware-shaped payloads
    // are covered in tests/image-processing.test.ts, which never touches a
    // socket.
    const fake = join(fixtures, "not-really.jpg");
    writeFileSync(fake, "this is plain text and definitely not a photograph");

    await signIn(page, TEACHER_SUN);
    await page.goto("/admin/photos");
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByLabel("Photos").setInputFiles([fake]);
    await page.getByRole("button", { name: /^Upload \d+ photo/ }).click();

    await expect(visibleText(page, "None of those files could be used")).toBeVisible();
    await expect(visibleText(page, "not-really.jpg")).toBeVisible();
  });

  test("a teacher cannot upload into a class they are not assigned to", async ({
    page,
  }) => {
    await signIn(page, TEACHER_SUN);
    await page.goto("/admin/photos");

    // Olives is simply not offered — and the server refuses it regardless,
    // which the data layer enforces.
    const options = await page.getByLabel("Class").locator("option").allTextContents();
    expect(options).toContain("Sunflowers");
    expect(options).not.toContain("Olives");
  });
});

/**
 * Publish one photo tagged only with Laila, and one shared with the whole
 * class. Captions identify them afterwards, so each test can find what it needs
 * without depending on another test having run first.
 */
// Unique per run: both Playwright projects share one database, so absolute
// counts would depend on whatever a previous project already published. Every
// assertion below is scoped to these captions instead.
const RUN = Date.now().toString().slice(-6);
const TAGGED_CAPTION = `Laila painting ${RUN}`;
const CLASS_CAPTION = `Sunflowers group ${RUN}`;
const DRAFT_CAPTION = `Unpublished draft ${RUN}`;

/**
 * Publish two photos in two separate uploads.
 *
 * Separate sessions on purpose: each tagging page then holds exactly one photo,
 * so there is no index juggling to identify which card is which. Sharing state
 * or positions between assertions is how the earlier version of this test
 * became flaky.
 */
async function publishOne(
  page: Page,
  file: string,
  caption: string,
  mode: "tag-laila" | "whole-class",
) {
  await uploadInto(page, "Sunflowers", [file]);

  await page.getByLabel("Caption").fill(caption);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  if (mode === "tag-laila") {
    await page.getByText("Laila", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();
    await expect(visibleText(page, "Tags saved")).toBeVisible();
  } else {
    await page.getByRole("button", { name: "Share with the whole class" }).click();
    await expect(visibleText(page, "Shared with the whole class")).toBeVisible();
  }

  await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
  await expect(visibleText(page, "Families can see them now")).toBeVisible();
}

async function publishFixture(page: Page) {
  await signIn(page, OWNER);

  await publishOne(
    page,
    await makePhoto("laila-only.jpg", "#FF7A6E"),
    TAGGED_CAPTION,
    "tag-laila",
  );

  await publishOne(
    page,
    await makePhoto("class-album.jpg", "#7AC0E4"),
    CLASS_CAPTION,
    "whole-class",
  );
}

/** Ids of the two published photos, as seen by a parent who can see both. */
async function photoIdsFor(page: Page, caption: string): Promise<string> {
  const link = page
    .locator('a[href^="/portal/albums/"]')
    .filter({ hasText: caption });

  const href = await link.first().getAttribute("href");
  return href!.split("/").pop()!;
}

test.describe("the routing rule, end to end", () => {
  test("a parent sees their own child's photo and the class album; another family sees only the class album", async ({
    page,
    request,
  }) => {
    await publishFixture(page);

    // --- Amal: Laila is tagged, and Laila is in Sunflowers -----------------
    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/albums");

    // Both of this run's photos reach her: rule (a) for the tagged one, rule
    // (b) for the class-wide one.
    await expect(visibleText(page, TAGGED_CAPTION)).toBeVisible();
    await expect(visibleText(page, CLASS_CAPTION)).toBeVisible();

    const lailaPhotoId = await photoIdsFor(page, TAGGED_CAPTION);
    const classPhotoId = await photoIdsFor(page, CLASS_CAPTION);
    expect(lailaPhotoId).toBeTruthy();
    expect(classPhotoId).toBeTruthy();
    expect(lailaPhotoId).not.toBe(classPhotoId);

    // --- Khalid: Zayn is in Sunflowers, but is not in Laila's photo --------
    await page.context().clearCookies();
    await signIn(page, PARENT_KHALID);
    await page.goto("/portal/albums");

    // Rule (b) reaches him; rule (a) does not. THE assertion of this phase.
    await expect(visibleText(page, CLASS_CAPTION)).toBeVisible();
    await expect(page.getByText(TAGGED_CAPTION)).toHaveCount(0);

    // --- The page: guessing the id gets a 404, not a 403 -------------------
    const pageResponse = await page.goto(`/portal/albums/${lailaPhotoId}`);
    expect(pageResponse?.status()).toBe(404);

    // --- The bytes: the real prize, and the real test ----------------------
    const cookies = (await page.context().cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    for (const variant of ["thumb", "web", "original"]) {
      const response = await request.get(
        `/api/img/${lailaPhotoId}?v=${variant}`,
        { headers: { Cookie: cookies }, maxRedirects: 0 },
      );
      expect(
        response.status(),
        `Khalid must not reach variant "${variant}" of Laila's photo`,
      ).toBe(404);
    }

    // He can reach the class-album photo, so the 404s above are the rule
    // working rather than everything being broken.
    const allowed = await request.get(`/api/img/${classPhotoId}?v=thumb`, {
      headers: { Cookie: cookies },
      maxRedirects: 0,
    });
    expect(allowed.status()).toBe(302);

    // --- Anonymous gets nothing -------------------------------------------
    const anonymous = await request.get(`/api/img/${classPhotoId}?v=thumb`, {
      maxRedirects: 0,
    });
    expect(anonymous.status()).toBe(404);

    // --- Image responses are never indexed or shared-cached ---------------
    expect(allowed.headers()["x-robots-tag"]).toContain("noindex");
    expect(allowed.headers()["cache-control"]).toContain("no-store");
  });
});

test.describe("unpublished photos reach nobody", () => {
  test("a photo that is uploaded but not published is invisible to parents", async ({
    page,
  }) => {
    const draft = await makePhoto("draft.jpg", "#FFC63F");

    await signIn(page, OWNER);
    await uploadInto(page, "Sunflowers", [draft]);

    // Tag Laila, but do NOT publish.
    const captionForm = page
      .locator("form", { has: page.getByLabel("Caption") })
      .first();
    await captionForm.getByLabel("Caption").fill(DRAFT_CAPTION);
    await captionForm.getByRole("button", { name: "Save" }).click();

    const cards = page.locator("form", {
      has: page.getByText("Who is in this photo?"),
    });
    await cards.nth(0).getByText("Laila", { exact: true }).click();
    await cards.nth(0).getByRole("button", { name: "Save tags" }).click();
    await expect(visibleText(page, "Tags saved").first()).toBeVisible();

    // Amal must not see it: publishedAt is null.
    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/albums");

    // The draft's caption never appears for her, however many other photos
    // exist from earlier runs.
    await expect(page.getByText(DRAFT_CAPTION)).toHaveCount(0);
  });
});
