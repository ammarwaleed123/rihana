import { expect, test, type Page } from "@playwright/test";

/**
 * Accident reports: recording, correcting, signing, and who can see them.
 *
 * The scoping assertions are the point of this file. An accident record names
 * an injury to a named child, and it must be unreachable by anyone outside that
 * family and that class — as a 404, never a 403, because a 403 confirms the
 * child is enrolled here. That includes the signature IMAGE, which is a
 * separate route and was the easiest thing to leave open.
 *
 * The fan-out assertions need the worker running, like the other notification
 * specs.
 */

const PASSWORD = "ChangeMe!Local123";
const TEACHER_SUN = "teacher.sun@rihana.test";
const TEACHER_OLIVE = "teacher.olive@rihana.test";
const OWNER = "owner@rihana.test";
const PARENT = "amal@rihana.test"; // Laila (Sunflowers), Omar (Olives)
const OTHER_PARENT = "khalid@rihana.test"; // Zayn (Sunflowers) — not Laila's
const CHILD = "Laila Saeed";

const DAY = new Date(Date.now() - 23 * 86_400_000).toISOString().slice(0, 10);

test.describe.configure({ mode: "serial", timeout: 240_000 });

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(portal|admin)/);
}

/** Draw a squiggle on the signature pad. */
async function sign(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible" });
  // page.mouse works in viewport coordinates and the pad sits far down a long
  // form; without this the strokes land on empty space above the fold.
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 30, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(box.x + 30 + i * 20, y + (i % 2 === 0 ? -18 : 18));
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Where the family's copy of this day lives. Filled by the first test. */
let familyUrl = "";
/** The teacher's signature image, for the scoping checks. */
let signatureUrl = "";

test.describe("a teacher records one", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signIn(page, TEACHER_SUN);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("the form refuses to file an unsigned record", async () => {
    await page.goto(`/admin/accidents?date=${DAY}`);
    await page.locator("li").filter({ hasText: CHILD }).first().getByRole("link").click();
    await page.waitForURL(/\/admin\/accidents\//);

    // A signature is not optional, and the button says so before anything else.
    await expect(
      page.getByRole("button", { name: "Record this accident" }),
    ).toBeDisabled();
  });

  test("and names every field that is still missing", async () => {
    await sign(page);
    await page.getByRole("button", { name: "Record this accident" }).click();

    const alert = page.getByTestId("form-alert").first();
    await expect(alert).toContainText("Time of the incident");
    await expect(alert).toContainText("Where it happened");
    await expect(alert).toContainText("Boy or girl");
    await expect(alert).toContainText("What happened");
  });

  test("the time of the call is asked for only once someone was called", async () => {
    await expect(page.locator("#notificationTime")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Parents were called" }).check();
    await expect(page.locator("#notificationTime")).toBeVisible();
    await page.getByRole("checkbox", { name: "Parents were called" }).uncheck();
    await expect(page.locator("#notificationTime")).toHaveCount(0);
  });

  test("a complete record is filed and reads back", async () => {
    await page.locator("#timeOfIncident").fill("10:15");
    await page.getByRole("radio", { name: "Garden", exact: true }).check();
    await page.getByRole("radio", { name: "Girl", exact: true }).check();
    await page.getByRole("checkbox", { name: "Knee", exact: true }).check();
    await page.getByRole("checkbox", { name: "Scratch", exact: true }).check();
    await page.getByRole("checkbox", { name: "Running water", exact: true }).check();
    await page.locator("#description").fill("Fell while running to the swings.");
    await sign(page);

    await page.getByRole("button", { name: "Record this accident" }).click();
    await expect(
      page.getByTestId("form-alert").filter({ hasText: "Recorded" }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await page.reload();
    await expect(page.getByText("10:15").first()).toBeVisible();
    await expect(page.getByText("Fell while running to the swings.")).toBeVisible();
    await expect(page.getByText("The family has not signed yet")).toBeVisible();

    signatureUrl = (await page
      .locator('img[src*="/api/img/signature/incident/"]')
      .first()
      .getAttribute("src"))!;
    expect(signatureUrl).toBeTruthy();
  });

  test("a teacher is not offered the delete button; the owner is", async ({
    browser,
  }) => {
    await expect(
      page.getByRole("button", { name: "Delete this record" }),
    ).toHaveCount(0);

    const ownerPage = await browser.newPage();
    await signIn(ownerPage, OWNER);
    await ownerPage.goto(page.url());
    await expect(
      ownerPage.getByRole("button", { name: "Delete this record" }).first(),
    ).toBeVisible();
    await ownerPage.close();
  });
});

test.describe("the family reads it and signs", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signIn(page, PARENT);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("the day screen points at it and says it needs a signature", async () => {
    await page.goto("/portal/reports");
    await expect(page.getByText("Needs your signature").first()).toBeVisible();
  });

  test("it reads as an account of what happened, not as a form", async () => {
    await page.goto("/portal/accidents");
    await page.locator("a[href^='/portal/accidents/']").first().click();
    await page.waitForURL(/\/portal\/accidents\/[a-z0-9]/i);
    familyUrl = page.url();

    await expect(page.getByText("Fell while running to the swings.")).toBeVisible();
    // No call was made, and that is said rather than left blank.
    await expect(page.getByText("No call was needed.")).toBeVisible();
    await expect(
      page.locator('img[src*="/api/img/signature/incident/"]').first(),
    ).toBeVisible();
  });

  test("a signature is required to acknowledge it", async () => {
    await expect(
      page.getByRole("button", { name: "I have been told" }).first(),
    ).toBeDisabled();

    await sign(page);
    await page.getByRole("button", { name: "I have been told" }).first().click();
    await expect(page.getByTestId("form-alert").first()).toBeVisible({
      timeout: 60_000,
    });

    await page.goto(familyUrl);
    await expect(page.getByText(/You signed this on/)).toBeVisible();
  });
});

/**
 * Scoping. The reason this feature was built carefully.
 *
 * Each of these is a 404 and not a 403: telling an unrelated parent "forbidden"
 * confirms that this child is enrolled at this nursery, which is the disclosure
 * the whole model exists to prevent.
 */
test.describe("nobody else can reach it", () => {
  test("another parent gets a 404, and so does the signature image", async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await signIn(page, OTHER_PARENT);

    const response = await page.goto(familyUrl);
    expect(response?.status()).toBe(404);

    const image = await page.request.get(signatureUrl);
    expect(image.status()).toBe(404);

    // And nothing of the other family leaks into their own list.
    await page.goto("/portal/accidents");
    await expect(page.getByText("Laila")).toHaveCount(0);

    await page.close();
  });

  test("a teacher of another class gets a 404", async ({ browser }) => {
    const page = await browser.newPage();
    await signIn(page, TEACHER_OLIVE);

    const image = await page.request.get(signatureUrl);
    expect(image.status()).toBe(404);

    await page.close();
  });

  test("signed out, it sends you to sign in", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(familyUrl);
    await expect(page).toHaveURL(/\/signin/);

    await context.close();
  });
});

/**
 * What the notification is allowed to say.
 *
 * It lands on a lock screen, where the reader is whoever is holding the phone.
 * It may say that something happened and that the family should look; it must
 * not say what was injured or what was done about it.
 */
test("the accident notification gives away nothing about the injury", async ({
  browser,
}) => {
  const page = await browser.newPage();
  await signIn(page, PARENT);

  // Fan-out runs in the worker, so poll rather than asserting immediately.
  await expect(async () => {
    await page.goto("/portal/notifications");
    await expect(page.getByText(/had an accident/).first()).toBeVisible();
  }).toPass({ timeout: 60_000 });

  const text = (await page.locator("body").innerText()).toLowerCase();
  for (const detail of ["knee", "scratch", "running water", "swings"]) {
    expect(text).not.toContain(detail);
  }
  // But it does name the child, or the family cannot tell who it is about.
  expect(text).toContain("laila");

  await page.close();
});
