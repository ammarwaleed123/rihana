import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * Phase 5: notifications and announcements.
 *
 * Fan-out runs in the worker, off the request, so these poll (reloading) rather
 * than asserting immediately — the same shape the photo suites use for anything
 * the worker does. They need the worker running with the Phase 5 handlers.
 */

const PASSWORD = "ChangeMe!Local123";
const OWNER = "owner@rihana.test";
const PARENT_AMAL = "amal@rihana.test"; // Laila (Sunflowers), Omar (Olives)
const PARENT_KHALID = "khalid@rihana.test"; // Zayn (Sunflowers)

test.describe.configure({ mode: "serial", timeout: 180_000 });

const RUN = Date.now().toString().slice(-6);
const fixtures = join(tmpdir(), "rihana-e2e-notifications");
mkdirSync(fixtures, { recursive: true });

async function makePhoto(name: string): Promise<string> {
  const path = join(fixtures, name);
  writeFileSync(
    path,
    await sharp({ create: { width: 600, height: 450, channels: 3, background: "#3E7C4F" } })
      .jpeg()
      .toBuffer(),
  );
  return path;
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(portal|admin)/);
}

function visibleText(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true });
}

/** The unread count from the header bell (0 when there is no badge). */
async function unreadFromBell(page: Page): Promise<number> {
  await page.goto("/portal");
  const label = await page
    .getByRole("link", { name: /Notifications/ })
    .getAttribute("aria-label");
  const match = label?.match(/(\d+)\s+unread/);
  return match ? Number(match[1]) : 0;
}

/** Reload the target until the text shows, allowing time for the worker. */
async function pollFor(page: Page, path: string, text: string | RegExp) {
  await expect(async () => {
    await page.goto(path);
    // `.first()`: a notification renders the text in both its title and its body,
    // and several may match at once (the reseed runs once per suite, so earlier
    // specs' notifications are still around). We only care that at least one is
    // there, not that exactly one is.
    await expect(visibleText(page, text).first()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 90_000 });
}

test.describe("photo notifications", () => {
  test("publishing a tagged photo notifies that child's family only", async ({
    page,
  }) => {
    const photo = await makePhoto(`notif-${RUN}.jpg`);

    // Owner uploads to Sunflowers, tags Laila, publishes.
    await signIn(page, OWNER);
    await page.goto("/admin/photos");
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByLabel("Photos").setInputFiles([photo]);
    await page.getByRole("button", { name: /^Upload \d+ photo/ }).click();
    await page.waitForURL(/\/admin\/photos\/[a-z0-9]+/);
    await page.getByText("Laila", { exact: true }).click();
    await page.getByRole("button", { name: "Save tags" }).click();
    await expect(visibleText(page, "Tags saved")).toBeVisible();
    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, /Families can see (it|them) now/)).toBeVisible();

    // Amal (Laila's parent) gets a notification naming Laila.
    await signIn(page, PARENT_AMAL);
    await pollFor(page, "/portal/notifications", /new photo.*Laila/i);

    // And the header bell shows an unread badge.
    await page.goto("/portal");
    await expect(
      page.getByRole("link", { name: /Notifications, \d+ unread/ }),
    ).toBeVisible();

    // Khalid (a different Sunflowers family) is NOT notified about Laila.
    await signIn(page, PARENT_KHALID);
    await page.goto("/portal/notifications");
    await expect(page.getByText(/Laila/)).toHaveCount(0);
  });

  test("tapping a notification marks it read and opens it", async ({ page }) => {
    await signIn(page, PARENT_AMAL);

    const before = await unreadFromBell(page);
    expect(before).toBeGreaterThan(0); // there is a Laila notification to read

    // Tapping the Laila notification navigates to her photos...
    await page.goto("/portal/notifications");
    await page.getByRole("button", { name: /new photo.*Laila/i }).first().click();
    await expect(page).toHaveURL(/\/portal\/photos\?childId=/);

    // ...and it is now read, so the unread count has dropped.
    const after = await unreadFromBell(page);
    expect(after).toBeLessThan(before);
  });

  test("marking all read clears the badge", async ({ page }) => {
    await signIn(page, PARENT_AMAL);

    // Fan-out is asynchronous: the worker may still be delivering notifications
    // from earlier tests, so a straggler can arrive between the click and the
    // check. Mark-all and re-check together, retrying until the badge stays
    // cleared — this asserts the same thing without racing the worker.
    await expect(async () => {
      await page.goto("/portal/notifications");
      const markAll = page.getByRole("button", { name: "Mark all as read" });
      if (await markAll.count()) await markAll.click();

      await page.goto("/portal");
      await expect(
        page.getByRole("link", { name: /Notifications, \d+ unread/ }),
      ).toHaveCount(0);
    }).toPass({ timeout: 30_000 });
  });
});

test.describe("album notifications", () => {
  test("publishing an album notifies families who can see it", async ({
    page,
  }) => {
    const caption = `Album notif ${RUN}`;

    // Owner: publish a whole-class Sunflowers photo, then an album holding it.
    await signIn(page, OWNER);
    await page.goto("/admin/photos");
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByLabel("Photos").setInputFiles([await makePhoto(`alb-${RUN}.jpg`)]);
    await page.getByRole("button", { name: /^Upload \d+ photo/ }).click();
    await page.waitForURL(/\/admin\/photos\/[a-z0-9]+/);
    await page.getByLabel("Caption").fill(caption);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Share with the whole class" }).click();
    await expect(visibleText(page, "Shared with the whole class")).toBeVisible();
    await page.getByRole("button", { name: /^Publish \d+ photo/ }).click();
    await expect(visibleText(page, /Families can see (it|them) now/)).toBeVisible();

    await page.goto("/admin/albums");
    await page.getByRole("button", { name: "New album" }).click();
    await page.getByLabel("Album title").fill(`Trip album ${RUN}`);
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByRole("button", { name: "Create album" }).click();
    await page.waitForURL(/\/admin\/albums\/[a-z0-9]+/);
    // Ticked with a retry: the box is a controlled input, `force` skips the
    // actionability wait, and a click that lands before React hydrates is
    // dropped without a word. See the longer note in albums.spec.ts.
    const photo = page.getByRole("checkbox", { name: caption });
    await expect(async () => {
      await photo.check({ force: true });
      await expect(photo).toBeChecked();
    }).toPass({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Add 1 photo/ }).click();
    await page.getByRole("button", { name: "Publish album" }).click();
    await expect(visibleText(page, "Album published")).toBeVisible();

    // A Sunflowers family is notified about the new album.
    await signIn(page, PARENT_KHALID);
    await pollFor(page, "/portal/notifications", new RegExp(`New album: Trip album ${RUN}`));
  });
});

test.describe("announcements", () => {
  const TITLE = `Closed Monday ${RUN}`;

  test("owner posts a whole-nursery announcement and families are notified", async ({
    page,
  }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/announcements");

    await page.getByRole("button", { name: "New announcement" }).click();
    await page.getByLabel("Title").fill(TITLE);
    await page.getByLabel("Who is this for?").selectOption({ label: "The whole nursery" });
    await page
      .getByLabel("Announcement")
      .fill("The nursery is **closed** on Monday for the holiday.");
    await page.getByRole("button", { name: "Create draft" }).click();

    await page.waitForURL(/\/admin\/announcements\/[a-z0-9]+/);
    await page.getByRole("button", { name: "Publish & notify" }).click();
    await expect(visibleText(page, "a notification is on its way")).toBeVisible();

    // Parent sees it in the feed, with the markdown rendered (not raw).
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/announcements");
    await expect(visibleText(page, TITLE)).toBeVisible();
    await expect(page.locator("strong", { hasText: "closed" })).toBeVisible();
    await expect(page.getByText("**closed**")).toHaveCount(0);

    // And a notification arrives.
    await pollFor(page, "/portal/notifications", "New announcement");
  });

  test("a class announcement reaches only that class", async ({ page }) => {
    const classTitle = `Sunflowers trip ${RUN}`;

    await signIn(page, OWNER);
    await page.goto("/admin/announcements");
    await page.getByRole("button", { name: "New announcement" }).click();
    await page.getByLabel("Title").fill(classTitle);
    await page.getByLabel("Who is this for?").selectOption({ label: "One class" });
    await page.getByLabel("Class").selectOption({ label: "Sunflowers" });
    await page.getByLabel("Announcement").fill("Wear wellies on Friday.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.waitForURL(/\/admin\/announcements\/[a-z0-9]+/);
    await page.getByRole("button", { name: "Publish & notify" }).click();
    await expect(visibleText(page, "a notification is on its way")).toBeVisible();

    // Amal has Laila in Sunflowers -> sees it.
    await signIn(page, PARENT_AMAL);
    await page.goto("/portal/announcements");
    await expect(visibleText(page, classTitle)).toBeVisible();
  });

  test("withdrawing an announcement removes its notification too", async ({
    page,
  }) => {
    const title = `Temporary notice ${RUN}`;

    // Publish it.
    await signIn(page, OWNER);
    await page.goto("/admin/announcements");
    await page.getByRole("button", { name: "New announcement" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Who is this for?").selectOption({ label: "The whole nursery" });
    await page.getByLabel("Announcement").fill("A short-lived note for the test.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.waitForURL(/\/admin\/announcements\/([a-z0-9]+)/);
    const announcementUrl = page.url();
    await page.getByRole("button", { name: "Publish & notify" }).click();
    await expect(visibleText(page, "a notification is on its way")).toBeVisible();

    // Parent gets the notification.
    await signIn(page, PARENT_KHALID);
    await pollFor(page, "/portal/notifications", new RegExp(title));

    // Owner withdraws it. Assert the specific success message so it can't collide
    // with the word appearing elsewhere on the page.
    await signIn(page, OWNER);
    await page.goto(announcementUrl.split("?")[0]);
    await page.getByRole("button", { name: "Withdraw" }).click();
    await expect(visibleText(page, "Withdrawn from families")).toBeVisible();

    // The notification is gone from the parent's list, not just the feed.
    await signIn(page, PARENT_KHALID);
    await page.goto("/portal/notifications");
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto("/portal/announcements");
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
