import { expect, test, type Page } from "@playwright/test";

/**
 * The daily report form: does it keep what a teacher puts into it?
 *
 * Every assertion here exists because the owner reported the same symptom
 * twice — "the fields disappear when I press save" — and it turned out to be
 * two unrelated causes:
 *
 *  1. The list of changed fields was collected by an onChange handler, which
 *     does not exist until React has hydrated. Anything typed in the first
 *     second was never sent. Whichever field she touched first was the one
 *     that vanished, which is why it looked random.
 *  2. React resets an uncontrolled form once its action completes, so every
 *     field snapped back to the value the page was rendered with. The save had
 *     worked; the screen wiped itself.
 *
 * Neither was visible to a test that checked the database and then reloaded —
 * which both of the original probes did. So these read the SCREEN, with no
 * reload and no navigation, and they wait on the POST rather than on the
 * "Saved" banner: after the first save that banner is already there, and
 * waiting for it matches instantly and races past a save that never happened.
 */

const PASSWORD = "ChangeMe!Local123";
const TEACHER = "teacher.sun@rihana.test";
const OWNER = "owner@rihana.test";
const CHILD = "Laila Saeed";

/*
 * Days of their own, so this suite cannot collide with the other report specs
 * — and so each test below can have a child to itself. A report is unique per
 * (child, day), and only three children are in this teacher's class.
 */
const DAY = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);
const DAY_NO_JS = new Date(Date.now() - 22 * 86_400_000).toISOString().slice(0, 10);

test.describe.configure({ mode: "serial", timeout: 180_000 });

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(portal|admin)/);
}

/** Open a child's report by name, from the day list. */
async function openReport(page: Page, child: string) {
  await page.goto(`/admin/reports?date=${DAY}`);
  await page.locator("li").filter({ hasText: child }).first().getByRole("link").click();
  await page.waitForURL(/\/admin\/reports\//);
}

/**
 * Press a button and wait for the action to come back.
 *
 * NOT for the confirmation banner: it survives from the previous save, so a
 * wait on it returns immediately and the test runs ahead of the save it is
 * supposed to be checking. That produced two convincing false failures.
 */
async function submitAndWait(page: Page, button: string) {
  const done = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/admin/reports/"),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: button, exact: true }).click();
  await done;
  // The action state lands a tick after the response.
  await page.waitForTimeout(500);
}

test.describe("what a teacher types stays on the screen", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signIn(page, TEACHER);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("a save does not wipe the form", async () => {
    await openReport(page, CHILD);

    await page.locator("#arrivalTime").fill("08:20");
    await page.getByRole("checkbox", { name: "Blocks Area", exact: true }).check();
    await page.getByRole("checkbox", { name: "Art Area", exact: true }).check();
    await page.locator("#alsoEnjoyed").fill("Water play");
    await page.locator('input[name="meal_LUNCH_amount"][value="ALL"]').check();
    await page.locator("#meal_LUNCH_description").fill("Rice and chicken");
    await page.locator("#toilet_0_time").fill("09:30");
    await page.locator('input[name="toilet_0_wet"]').check();
    await page.locator("#napFrom").fill("12:30");
    await page.locator('input[name="bringCleanClothes"]').check();
    await page.locator("#teacherComments").fill("A settled day.");

    await submitAndWait(page, "Save");

    // The screen, immediately, with no reload. This is what the owner saw.
    await expect(page.locator("#arrivalTime")).toHaveValue("08:20");
    await expect(page.getByRole("checkbox", { name: "Blocks Area", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Art Area", exact: true })).toBeChecked();
    await expect(page.locator("#alsoEnjoyed")).toHaveValue("Water play");
    await expect(page.locator('input[name="meal_LUNCH_amount"][value="ALL"]')).toBeChecked();
    await expect(page.locator("#meal_LUNCH_description")).toHaveValue("Rice and chicken");
    await expect(page.locator("#toilet_0_time")).toHaveValue("09:30");
    await expect(page.locator('input[name="toilet_0_wet"]')).toBeChecked();
    await expect(page.locator("#napFrom")).toHaveValue("12:30");
    await expect(page.locator('input[name="bringCleanClothes"]')).toBeChecked();
    await expect(page.locator("#teacherComments")).toHaveValue("A settled day.");
  });

  // The first attempt at the fix put the values back after the reset instead of
  // preventing it. That worked once and lost the race on the second save — a
  // bug that only appears the second time anyone uses the screen.
  test("nor does the second save of a session", async () => {
    await page.locator("#teacherComments").fill("A settled day. Ate very well.");
    await submitAndWait(page, "Save");

    await expect(page.locator("#teacherComments")).toHaveValue("A settled day. Ate very well.");
    await expect(page.locator("#arrivalTime")).toHaveValue("08:20");
    await expect(page.locator("#meal_LUNCH_description")).toHaveValue("Rice and chicken");
    await expect(page.getByRole("checkbox", { name: "Art Area", exact: true })).toBeChecked();
  });

  test("and it survives a reload, so it really was stored", async () => {
    await page.reload();

    await expect(page.locator("#arrivalTime")).toHaveValue("08:20");
    await expect(page.locator("#teacherComments")).toHaveValue("A settled day. Ate very well.");
    await expect(page.locator("#meal_LUNCH_description")).toHaveValue("Rice and chicken");
    await expect(page.getByRole("checkbox", { name: "Blocks Area", exact: true })).toBeChecked();
  });

  // Clearing a box is a change like any other. An earlier version of the fix
  // refreshed the route after saving, and the re-render put this tick back.
  test("clearing a tick box sticks", async () => {
    await page.getByRole("checkbox", { name: "Art Area", exact: true }).uncheck();
    await submitAndWait(page, "Save");

    await expect(page.getByRole("checkbox", { name: "Art Area", exact: true })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Blocks Area", exact: true })).toBeChecked();

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Art Area", exact: true })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Blocks Area", exact: true })).toBeChecked();
  });
});

/**
 * Typing before the page has finished loading.
 *
 * The whole first bug. Filling a field immediately after navigation, with no
 * wait for hydration, is the closest a headless browser gets to a teacher on
 * nursery wifi starting to type the moment the form appears.
 */
test("a field filled before the page finishes loading is still saved", async ({
  browser,
}) => {
  const page = await browser.newPage();
  await signIn(page, TEACHER);

  await page.goto(`/admin/reports?date=${DAY}`);
  await page.locator("li").filter({ hasText: "Zayn Rahman" }).first().getByRole("link").click();
  await page.waitForURL(/\/admin\/reports\//);

  // No settling, no waiting: straight in.
  await page.locator("#arrivalTime").fill("08:05");
  await page.locator("#teacherComments").fill("Typed immediately.");
  await submitAndWait(page, "Save");

  await page.reload();
  await expect(page.locator("#arrivalTime")).toHaveValue("08:05");
  await expect(page.locator("#teacherComments")).toHaveValue("Typed immediately.");

  await page.close();
});

/**
 * Two teachers on one report.
 *
 * The reason a save only writes changed fields at all. If this breaks, the
 * second teacher to save silently erases the first one's work — which is worse
 * than the bug this file is mostly about, because nobody sees it happen.
 */
test("one teacher's save does not erase another's", async ({ browser }) => {
  const first = await browser.newPage();
  const second = await browser.newPage();

  await signIn(first, TEACHER);
  await signIn(second, OWNER);

  await openReport(first, "Tariq Darwish");
  const url = first.url();
  await second.goto(url);

  // She fills the nap.
  await first.locator("#napFrom").fill("12:30");
  await first.locator("#napUntil").fill("13:45");
  await submitAndWait(first, "Save");

  // He is still holding the page from before that, and fills lunch. His form
  // still shows the nap as empty — that must not count as clearing it.
  await second.locator('input[name="meal_LUNCH_amount"][value="ALL"]').check();
  await second.locator("#meal_LUNCH_description").fill("Rice");
  await submitAndWait(second, "Save");

  await first.reload();
  await expect(first.locator("#napFrom")).toHaveValue("12:30");
  await expect(first.locator("#napUntil")).toHaveValue("13:45");
  await expect(first.locator("#meal_LUNCH_description")).toHaveValue("Rice");

  // A deliberate correction to the other teacher's field must still apply.
  await second.reload();
  await second.locator("#napFrom").fill("12:45");
  await submitAndWait(second, "Save");

  await first.reload();
  await expect(first.locator("#napFrom")).toHaveValue("12:45");
  await expect(first.locator("#napUntil")).toHaveValue("13:45");

  await first.close();
  await second.close();
});

/**
 * With JavaScript switched off.
 *
 * Not an exotic case: it is what every phone looks like for the moment before
 * the script arrives. It is also the check that caught a regression during the
 * fix — passing the form an inline function instead of the action itself works
 * perfectly with JavaScript and leaves a form that posts nowhere without it.
 */
test("saving works with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/signin");
  await page.getByLabel("Email").fill(TEACHER);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);

  // Its own day, so nothing above has already written to this report.
  await page.goto(`/admin/reports?date=${DAY_NO_JS}`);
  await page.locator("li").filter({ hasText: CHILD }).first().getByRole("link").click();
  await page.waitForURL(/\/admin\/reports\//);
  const reportUrl = page.url();

  await page.locator("#alsoEnjoyed").fill("Sand tray");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(4000);

  await page.goto(reportUrl);
  await expect(page.locator("#alsoEnjoyed")).toHaveValue("Sand tray");

  await context.close();
});
