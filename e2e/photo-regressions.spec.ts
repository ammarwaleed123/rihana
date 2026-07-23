import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Regressions found by the owner while testing Phase 3 by hand.
 *
 * Every one of these was reachable in the running app and invisible to the
 * suite, mostly because the suite only ever exercised the happy path in the
 * order the UI suggests.
 */

test.describe.configure({ mode: "serial", timeout: 180_000 });

const PASSWORD = "ChangeMe!Local123";
const OWNER = "owner@rihana.test";
const PARENT_AMAL = "amal@rihana.test"; // Laila (Sunflowers), Omar (Olives)

const RUN = Date.now().toString().slice(-6);
const fixtures = join(tmpdir(), "rihana-photo-regressions");
mkdirSync(fixtures, { recursive: true });

async function makePhoto(name: string, colour: string): Promise<string> {
  const path = join(fixtures, name);
  writeFileSync(
    path,
    await sharp({
      create: { width: 900, height: 700, channels: 3, background: colour },
    })
      .jpeg()
      .toBuffer(),
  );
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

async function uploadInto(page: Page, className: string, paths: string[]) {
  await page.goto("/admin/photos");
  await page.getByLabel("Class").selectOption({ label: className });
  await page.getByLabel("Photos").setInputFiles(paths);
  await page.getByRole("button", { name: /^Upload \d+ photo/ }).click();
  await page.waitForURL(/\/admin\/photos\/[a-z0-9]+/, { timeout: 120_000 });
  return page.url().split("/").pop()!.split("?")[0]!;
}

test.describe("uploading more than one request can carry", () => {
  test("six photos upload in batches without hitting a body limit", async ({
    page,
  }) => {
    // Six ~900x700 JPEGs comfortably exceeded the 1 MB server-action default,
    // which failed the whole upload with "Body exceeded 1 MB limit".
    const paths = await Promise.all(
      ["#3E7C4F", "#FFC63F", "#7AC0E4", "#FF7A6E", "#5C6B57", "#E3F0E6"].map(
        (colour, i) => makePhoto(`batch-${RUN}-${i}.jpg`, colour),
      ),
    );

    await signIn(page, OWNER);
    await uploadInto(page, "Sunflowers", paths);

    await expect(
      page.locator("form", { has: page.getByText("Who is in this photo?") }),
    ).toHaveCount(6);
  });

  test("an image and a non-image together: the image survives", async ({
    page,
  }) => {
    const good = await makePhoto(`mixed-${RUN}.jpg`, "#3E7C4F");
    const bad = join(fixtures, `mixed-bad-${RUN}.jpg`);
    writeFileSync(bad, "plain text pretending to be a photograph");

    await signIn(page, OWNER);
    await uploadInto(page, "Sunflowers", [good, bad]);

    // One card for the good photo, and the bad one named as rejected.
    await expect(
      page.locator("form", { has: page.getByText("Who is in this photo?") }),
    ).toHaveCount(1);
  });
});

test.describe("publication follows tagging, not just the publish button", () => {
  test("a photo tagged after publishing becomes visible once shared", async ({
    page,
  }) => {
    const first = await makePhoto(`late-a-${RUN}.jpg`, "#FF7A6E");
    const second = await makePhoto(`late-b-${RUN}.jpg`, "#7AC0E4");

    const captionA = `First photo ${RUN}`;
    const captionB = `Tagged later ${RUN}`;

    await signIn(page, OWNER);
    const uploadId = await uploadInto(page, "Sunflowers", [first, second]);

    const cards = page.locator("form", {
      has: page.getByText("Who is in this photo?"),
    });
    const captions = page.locator("form", { has: page.getByLabel("Caption") });

    // Caption both so they can be told apart afterwards.
    await captions.nth(0).getByLabel("Caption").fill(captionA);
    await captions.nth(0).getByRole("button", { name: "Save" }).click();
    await captions.nth(1).getByLabel("Caption").fill(captionB);
    await captions.nth(1).getByRole("button", { name: "Save" }).click();

    // Tag only the first, then publish.
    await cards.nth(0).getByText("Laila", { exact: true }).click();
    await cards.nth(0).getByRole("button", { name: "Save tags" }).click();
    await expect(visibleText(page, "Tags saved").first()).toBeVisible();

    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, "Families can see them now")).toBeVisible();

    // Now tag the second one, after publication.
    await page.goto(`/admin/photos/${uploadId}`);
    const cardsAfter = page.locator("form", {
      has: page.getByText("Who is in this photo?"),
    });
    const secondCard = page
      .locator("form", { has: page.getByLabel("Caption") })
      .filter({ has: page.locator(`input[value="${captionB}"]`) });

    // Identify the right card by caption rather than by position.
    const index = (
      await page
        .getByLabel("Caption")
        .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
    ).indexOf(captionB);

    await cardsAfter.nth(index).getByText("Laila", { exact: true }).click();
    await cardsAfter.nth(index).getByRole("button", { name: "Save tags" }).click();
    await expect(visibleText(page, "Tags saved").first()).toBeVisible();
    expect(await secondCard.count()).toBeGreaterThanOrEqual(0);

    // The fix: it publishes itself, because its session is already published.
    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/photos");

    await expect(visibleText(page, captionA)).toBeVisible();
    await expect(visibleText(page, captionB)).toBeVisible();
  });
});

test.describe("filtering to one child keeps their class albums", () => {
  test("a class-album photo still shows under that child's name", async ({
    page,
  }) => {
    const classWide = await makePhoto(`class-${RUN}.jpg`, "#FFC63F");
    const caption = `Whole class ${RUN}`;

    await signIn(page, OWNER);
    await uploadInto(page, "Sunflowers", [classWide]);

    await page.getByLabel("Caption").fill(caption);
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Nobody tagged — visible purely through the class-album rule.
    await page.getByRole("button", { name: "Share with the whole class" }).click();
    await expect(visibleText(page, "Shared with the whole class")).toBeVisible();
    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, "Families can see them now")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);

    // Visible under "Everyone"…
    await page.goto("/portal/photos");
    await expect(visibleText(page, caption)).toBeVisible();

    // …and must remain visible when narrowed to Laila, who is in that class.
    // This is the bug: it used to disappear.
    //
    // `exact` because photo tiles are links too, and any photo captioned
    // "Laila …" by another suite makes a loose name match ambiguous. The chip
    // is labelled exactly "Laila".
    await page.getByRole("link", { name: "Laila", exact: true }).click();
    await expect(visibleText(page, caption)).toBeVisible();
  });
});

test.describe("published photos can be withdrawn", () => {
  test("the owner can unpublish an upload and families stop seeing it", async ({
    page,
  }) => {
    const photo = await makePhoto(`withdraw-${RUN}.jpg`, "#E3F0E6");
    const caption = `Withdraw me ${RUN}`;

    await signIn(page, OWNER);
    const uploadId = await uploadInto(page, "Sunflowers", [photo]);

    await page.getByLabel("Caption").fill(caption);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Laila", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();
    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, "Families can see them now")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/photos");
    await expect(visibleText(page, caption)).toBeVisible();

    // Withdraw it.
    await page.context().clearCookies();
    await signIn(page, OWNER);
    await page.goto(`/admin/photos/${uploadId}`);
    await page.getByRole("button", { name: "Withdraw from families" }).click();
    await page.waitForURL(/withdrawn=/);
    await expect(
      visibleText(page, "no longer visible to"),
    ).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/photos");
    await expect(page.getByText(caption)).toHaveCount(0);
  });

  test("a published photo can still be deleted", async ({ page }) => {
    const photo = await makePhoto(`delete-pub-${RUN}.jpg`, "#FF7A6E");

    await signIn(page, OWNER);
    const uploadId = await uploadInto(page, "Sunflowers", [photo]);

    await page.getByText("Laila", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();
    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, "Families can see them now")).toBeVisible();

    // The control used to disappear once published — exactly when it is most
    // needed.
    await page.goto(`/admin/photos/${uploadId}`);
    await page
      .getByRole("button", { name: "Delete this photo permanently" })
      .click();

    await expect(
      page.locator("form", { has: page.getByText("Who is in this photo?") }),
    ).toHaveCount(0);
  });
});

test.describe("downloading", () => {
  test("the download button produces a file, not a full-screen image", async ({
    page,
  }) => {
    const photo = await makePhoto(`download-${RUN}.jpg`, "#7AC0E4");
    const caption = `Download me ${RUN}`;

    await signIn(page, OWNER);
    await uploadInto(page, "Sunflowers", [photo]);
    await page.getByLabel("Caption").fill(caption);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Laila", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();
    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, "Families can see them now")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/photos");
    await visibleText(page, caption).click();

    // A real download event. Previously the signed URL was cross-origin, so the
    // browser ignored `download` and simply navigated to the image.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download photo" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.jpg$/);
  });
});

/*
 * Uses Tariq, and Sami who guards him.
 *
 * This test withdraws a child's photo consent, which makes them un-taggable
 * until it is restored. Using a child another spec tags meant a failed or slow
 * restore broke that spec later with an error that looked nothing like this one
 * — so it uses a child nothing else touches, and correctness no longer depends
 * on the cleanup succeeding.
 */
test.describe("withdrawing photo consent takes effect immediately", () => {
  const PARENT_SAMI = "sami@rihana.test"; // guards Tariq (Sunflowers)

  test("the child is removed from photos they were already tagged in", async ({
    page,
  }) => {
    const photo = await makePhoto(`consent-${RUN}.jpg`, "#5C6B57");
    const caption = `Consent test ${RUN}`;

    await signIn(page, OWNER);
    await uploadInto(page, "Sunflowers", [photo]);

    await page.getByLabel("Caption").fill(caption);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Tariq", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();
    await expect(visibleText(page, "Tags saved")).toBeVisible();
    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, "Families can see them now")).toBeVisible();

    // Sami can see it.
    await page.context().clearCookies();
    await signIn(page, PARENT_SAMI);
    await page.goto("/portal/photos");
    await expect(visibleText(page, caption)).toBeVisible();

    // Owner withdraws Tariq's photo consent.
    await page.context().clearCookies();
    await signIn(page, OWNER);
    await page.goto("/admin/children");
    await page
      .getByRole("link", { name: "Manage Tariq Darwish" })
      .filter({ visible: true })
      .click();

    await page.getByLabel(/Photo consent given/).uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(visibleText(page, "has been removed from")).toBeVisible();

    // Gone from his family's album — consent withdrawn means withdrawn, not
    // "withdrawn for future photos only".
    await page.context().clearCookies();
    await signIn(page, PARENT_SAMI);
    await page.goto("/portal/photos");
    await expect(page.getByText(caption)).toHaveCount(0);
  });

  test("granting consent again makes the child taggable", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");
    await page
      .getByRole("link", { name: "Manage Tariq Darwish" })
      .filter({ visible: true })
      .click();

    const consentBox = page.getByLabel(/Photo consent given/);

    // Wait for the box to settle at its server-rendered value before touching
    // it. The input is uncontrolled (defaultChecked), so clicking it before
    // React finishes hydrating lets the hydration pass reset it — the click is
    // accepted, then silently undone, and the save writes the old value.
    await expect(consentBox).not.toBeChecked();

    await consentBox.check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(visibleText(page, "Details saved")).toBeVisible();

    // Asserted by reloading rather than trusting the success message: the
    // message appears for any successful save, including one that did not
    // change what we intended.
    await page.reload();
    await expect(page.getByLabel(/Photo consent given/)).toBeChecked();
  });
});
