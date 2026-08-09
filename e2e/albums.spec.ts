import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Phase 4: albums.
 *
 * The one thing these have to prove is that an album does NOT share a photo.
 * It is the obvious way for this feature to go wrong, because "album" means
 * "shared collection" everywhere else on the internet. Here it is a view over
 * photos each family could already see, and the assertions below are written
 * against a second family who must see strictly less of the same album.
 */

const PASSWORD = "ChangeMe!Local123";
const OWNER = "owner@rihana.test";
const TEACHER_OLIVE = "teacher.olive@rihana.test";

// Amal has Laila (Sunflowers) and Omar (Olives).
const PARENT_AMAL = "amal@rihana.test";
// Khalid has Zayn (Sunflowers) — same class as Laila, different child.
const PARENT_KHALID = "khalid@rihana.test";

test.describe.configure({ mode: "serial", timeout: 180_000 });

const RUN = Date.now().toString().slice(-6);
const ALBUM_TITLE = `Sports Day ${RUN}`;
const TAGGED_CAPTION = `Laila jumping ${RUN}`;
const CLASS_CAPTION = `Sunflowers lined up ${RUN}`;

const fixtures = join(tmpdir(), "rihana-e2e-albums");
mkdirSync(fixtures, { recursive: true });

async function makePhoto(name: string, colour: string): Promise<string> {
  const path = join(fixtures, name);
  const buffer = await sharp({
    create: { width: 800, height: 600, channels: 3, background: colour },
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

function visibleText(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true });
}

/** Upload one photo into Sunflowers, caption it, tag or share it, publish. */
async function publishOne(
  page: Page,
  file: string,
  caption: string,
  mode: "tag-laila" | "whole-class",
) {
  await page.goto("/admin/photos");
  await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
  await page.getByLabel("Photos").setInputFiles([file]);
  await page.getByRole("button", { name: /^Upload \d+ photo/ }).click();
  await page.waitForURL(/\/admin\/photos\/[a-z0-9]+/);

  await page.getByLabel("Caption").fill(caption);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  /*
   * These waits are on server actions that write and then revalidate, and this
   * suite runs interleaved with the whole test run against one dev server. The
   * default 5s assertion budget is for a quiet local page; under that
   * contention a visibility toggle can legitimately take longer, and a 5s wait
   * flaked in the full run while passing every time in isolation. The action is
   * fast; the timeout was just measuring the wrong thing.
   */
  const settle = { timeout: 20_000 };

  if (mode === "tag-laila") {
    await page.getByText("Laila", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();
    await expect(visibleText(page, "Tags saved")).toBeVisible(settle);
  } else {
    await page.getByRole("button", { name: "Share with the whole class" }).click();
    await expect(visibleText(page, "Shared with the whole class")).toBeVisible(settle);
  }

  await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
  await expect(visibleText(page, /Families can see (it|them) now/)).toBeVisible(settle);
}

/**
 * Tick a photo in the album picker by its caption.
 *
 * Reloads while waiting. The picker only offers photos that have finished
 * processing, and processing happens in the worker — so a photo published a
 * second ago may legitimately not be there yet, and the picker is
 * server-rendered, so it will never notice on its own. `force` because the
 * checkbox is `sr-only`: a person clicks the label wrapping it, and the
 * thumbnail sits over the input itself.
 */
async function pick(page: Page, caption: string) {
  const checkbox = page.getByRole("checkbox", { name: caption });

  await expect(async () => {
    if ((await checkbox.count()) === 0) {
      await page.reload();
    }
    await expect(checkbox).toHaveCount(1);
  }).toPass({ timeout: 60_000 });

  await checkbox.check({ force: true });
}

/** Create the album and put both published photos in it. Returns its id. */
async function buildAlbum(page: Page): Promise<string> {
  await signIn(page, OWNER);

  await publishOne(
    page,
    await makePhoto(`laila-${RUN}.jpg`, "#FF7A6E"),
    TAGGED_CAPTION,
    "tag-laila",
  );
  await publishOne(
    page,
    await makePhoto(`class-${RUN}.jpg`, "#7AC0E4"),
    CLASS_CAPTION,
    "whole-class",
  );

  await page.goto("/admin/albums");
  await page.getByRole("button", { name: "New album" }).click();
  await page.getByLabel("Album title").fill(ALBUM_TITLE);
  await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
  await page.getByRole("button", { name: "Create album" }).click();

  await page.waitForURL(/\/admin\/albums\/[a-z0-9]+/);
  const albumId = page.url().split("/").pop()!.split("?")[0];

  /*
   * Selected by caption, not by position.
   *
   * `force` because the checkbox is `sr-only` — a real person clicks the label
   * wrapping it, and the thumbnail sits over the input itself. The accessible
   * name is what makes addressing it by caption possible at all.
   */
  await pick(page, TAGGED_CAPTION);
  await pick(page, CLASS_CAPTION);
  await page.getByRole("button", { name: /^Add 2 photos/ }).click();
  await expect(visibleText(page, "Added 2 photos")).toBeVisible();

  await page.getByRole("button", { name: "Publish album" }).click();
  await expect(visibleText(page, "Album published")).toBeVisible();

  return albumId;
}

test.describe("albums never widen access", () => {
  let albumId: string;

  test("the owner builds and publishes an album", async ({ page }) => {
    albumId = await buildAlbum(page);
    expect(albumId).toBeTruthy();
  });

  test("each family sees the same album, holding only their own photos", async ({
    page,
  }) => {
    // --- Amal: Laila is tagged in one, and is in the class for the other ---
    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/albums");

    await expect(visibleText(page, ALBUM_TITLE)).toBeVisible();
    await page.getByRole("link", { name: new RegExp(ALBUM_TITLE) }).click();

    await expect(visibleText(page, TAGGED_CAPTION)).toBeVisible();
    await expect(visibleText(page, CLASS_CAPTION)).toBeVisible();

    // --- Khalid: same album, one photo fewer. THE assertion of this phase --
    await page.context().clearCookies();
    await signIn(page, PARENT_KHALID);
    await page.goto(`/portal/albums/${albumId}`);

    await expect(visibleText(page, CLASS_CAPTION)).toBeVisible();
    // Laila's photo is in this album. Being in it changes nothing.
    await expect(page.getByText(TAGGED_CAPTION)).toHaveCount(0);
  });

  test("the album's photo count is what THIS family can see, not its real size", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await signIn(page, PARENT_KHALID);
    await page.goto("/portal/albums");

    // Two photos are in the album; Khalid may see one. Telling him "2 photos"
    // would disclose that a photo of someone else's child exists in it.
    const card = page.getByRole("link", { name: new RegExp(ALBUM_TITLE) });
    await expect(card).toContainText("1 photo");
    await expect(card).not.toContainText("2 photos");
  });

  test("an album with nothing in it for you does not exist", async ({
    page,
  }) => {
    // Build an album holding only Laila's photo, then look at it as Khalid.
    await page.context().clearCookies();
    await signIn(page, OWNER);

    await page.goto("/admin/albums");
    await page.getByRole("button", { name: "New album" }).click();
    await page.getByLabel("Album title").fill(`Laila only ${RUN}`);
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByRole("button", { name: "Create album" }).click();
    await page.waitForURL(/\/admin\/albums\/[a-z0-9]+/);

    const privateAlbumId = page.url().split("/").pop()!.split("?")[0];

    // Only Laila's photo goes in. Khalid must not see this album at all.
    await pick(page, TAGGED_CAPTION);
    await page.getByRole("button", { name: /^Add 1 photo/ }).click();
    await page.getByRole("button", { name: "Publish album" }).click();
    await expect(visibleText(page, "Album published")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, PARENT_KHALID);

    // Not listed...
    await page.goto("/portal/albums");
    await expect(page.getByText(`Laila only ${RUN}`)).toHaveCount(0);

    // ...and 404 by id, not 403. A 403 would confirm it exists.
    const response = await page.goto(`/portal/albums/${privateAlbumId}`);
    expect(response?.status()).toBe(404);
  });

  test("withdrawing an album hides it but leaves the photos alone", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await signIn(page, OWNER);

    await page.goto(`/admin/albums/${albumId}`);
    await page.getByRole("button", { name: "Withdraw album" }).click();
    await expect(visibleText(page, "Album withdrawn")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);

    await page.goto("/portal/albums");
    await expect(page.getByText(ALBUM_TITLE)).toHaveCount(0);

    // The photos themselves were never the album's to hide.
    await page.goto("/portal/photos");
    await expect(visibleText(page, TAGGED_CAPTION)).toBeVisible();
    await expect(visibleText(page, CLASS_CAPTION)).toBeVisible();
  });

  test("deleting an album does not delete its photos", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page, OWNER);

    await page.goto(`/admin/albums/${albumId}`);
    await page.getByLabel(/Type .* to confirm/).fill(ALBUM_TITLE);
    await page.getByRole("button", { name: "Delete this album" }).click();
    await expect(visibleText(page, "The photos in it were not touched")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/photos");

    await expect(visibleText(page, TAGGED_CAPTION)).toBeVisible();
    await expect(visibleText(page, CLASS_CAPTION)).toBeVisible();
  });
});

test.describe("album authorization", () => {
  test("a teacher cannot open another class's DRAFT album", async ({ page }) => {
    await signIn(page, OWNER);

    await page.goto("/admin/albums");
    await page.getByRole("button", { name: "New album" }).click();
    await page.getByLabel("Album title").fill(`Sunflowers private ${RUN}`);
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByRole("button", { name: "Create album" }).click();
    await page.waitForURL(/\/admin\/albums\/[a-z0-9]+/);

    const sunflowersAlbumId = page.url().split("/").pop()!.split("?")[0];

    // A DRAFT belongs to the class still preparing it. The Olives teacher gets
    // 404, not 403, and it is not on their list.
    await page.context().clearCookies();
    await signIn(page, TEACHER_OLIVE);

    const response = await page.goto(`/admin/albums/${sunflowersAlbumId}`);
    expect(response?.status()).toBe(404);

    await page.goto("/admin/albums");
    await expect(page.getByText(`Sunflowers private ${RUN}`)).toHaveCount(0);
  });

  test("a teacher can VIEW another class's PUBLISHED album, but not edit it", async ({
    page,
    request,
  }) => {
    /*
     * The reported bug and the requested behaviour: a Sunflowers album the
     * owner filled with photos should be viewable by every teacher — thumbnails
     * and all — while only the Sunflowers teacher may edit it. Here the Olives
     * teacher looks at a published Sunflowers album.
     */
    const caption = `Shared album photo ${RUN}`;

    await signIn(page, OWNER);
    await publishOne(
      page,
      await makePhoto(`shared-${RUN}.jpg`, "#3E7C4F"),
      caption,
      "whole-class",
    );

    await page.goto("/admin/albums");
    await page.getByRole("button", { name: "New album" }).click();
    await page.getByLabel("Album title").fill(`Shared album ${RUN}`);
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByRole("button", { name: "Create album" }).click();
    await page.waitForURL(/\/admin\/albums\/[a-z0-9]+/);
    const albumId = page.url().split("/").pop()!.split("?")[0];

    await pick(page, caption);
    await page.getByRole("button", { name: /^Add 1 photo/ }).click();
    await page.getByRole("button", { name: "Publish album" }).click();
    await expect(visibleText(page, "Album published")).toBeVisible();

    // --- Olives teacher: sees it, opens it, no edit controls ---------------
    await page.context().clearCookies();
    await signIn(page, TEACHER_OLIVE);

    await page.goto("/admin/albums");
    await expect(visibleText(page, `Shared album ${RUN}`)).toBeVisible();

    const response = await page.goto(`/admin/albums/${albumId}`);
    expect(response?.status()).toBe(200);

    await expect(
      visibleText(page, "Only the Sunflowers teacher can edit"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw album" })).toHaveCount(0);
    await expect(page.getByText("Add photos")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);

    // The thumbnail actually loads for them — the crux of the bug. The image
    // route must authorize this cross-class photo because it is in a published
    // album.
    const src = await page
      .locator('img[src^="/api/img/"]')
      .first()
      .getAttribute("src");
    expect(src).toBeTruthy();

    const cookies = (await page.context().cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const imageResponse = await request.get(src!, { headers: { cookie: cookies } });
    expect(imageResponse.status()).toBeLessThan(400);
  });

  test("a teacher cannot create a nursery-wide album", async ({ page }) => {
    await signIn(page, TEACHER_OLIVE);
    await page.goto("/admin/albums");
    await page.getByRole("button", { name: "New album" }).click();

    // The option is simply not offered. The server refuses it regardless,
    // which is what the data layer enforces.
    const options = await page
      .getByLabel("Class")
      .locator("option")
      .allTextContents();

    expect(options).not.toContain("Whole nursery");
    expect(options).toContain("Olives");
  });

  test("a parent cannot reach the admin album pages at all", async ({
    page,
  }) => {
    await signIn(page, PARENT_AMAL);

    await page.goto("/admin/albums");
    await expect(page).toHaveURL("/portal");
  });
});
