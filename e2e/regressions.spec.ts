import { expect, test, type Page } from "@playwright/test";

/**
 * Regression tests for bugs found by the owner during manual testing.
 *
 * Every one of these was reported by a human looking at the running app, not by
 * the suite. They are kept together so it stays obvious what the automated tests
 * missed the first time.
 */

const PASSWORD = "ChangeMe!Local123";
const OWNER = "owner@rihana.test";
const TEACHER_SUN = "teacher.sun@rihana.test";

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

test.describe("navigation: exactly one tab is current", () => {
  // Was: every page also lit up "Overview", because "/admin/classes" starts
  // with "/admin/". The longest matching href now wins.
  for (const [path, label] of [
    ["/admin", "Overview"],
    ["/admin/children", "Children"],
    ["/admin/classes", "Classes"],
    ["/admin/people", "Parents & staff"],
    ["/admin/activity", "Activity"],
  ] as const) {
    test(`${path} marks only "${label}"`, async ({ page }) => {
      await signIn(page, OWNER);
      await page.goto(path);

      const current = page.locator('nav a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(label);
    });
  }
});

test.describe("permanent deletion actually erases", () => {
  test("a deleted child is gone from the list, not merely hidden", async ({
    page,
  }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    const last = `Erase${Date.now().toString().slice(-6)}`;
    const fullName = `Temp ${last}`;

    await page.getByRole("button", { name: "Add a child" }).click();
    await page.getByLabel("First name").fill("Temp");
    await page.getByLabel("Last name").fill(last);
    await page.getByLabel("Date of birth").fill("2023-05-05");
    await page.getByRole("button", { name: "Add child" }).click();
    await expect(visibleText(page, fullName)).toBeVisible();

    await page
      .getByRole("link", { name: `Manage ${fullName}` })
      .filter({ visible: true })
      .click();

    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page.getByLabel(`Type "${fullName}" to confirm`).fill(fullName);
    await page
      .getByRole("button", { name: `Permanently delete ${fullName}` })
      .click();

    // Deleting navigates back to the roster: the child's own page cannot render
    // its subject any more. Confirming this here means a silently-rejected form
    // cannot be mistaken for a successful deletion further down.
    await page.waitForURL(/\/admin\/children\?deleted=/);
    await expect(
      visibleText(page, "record was permanently deleted"),
    ).toBeVisible();

    await page.goto("/admin/children");
    await expect(page.getByText(fullName)).toHaveCount(0);

    // And still absent when archived records are included — the old bug left
    // the row behind with a deletedAt timestamp, which this would have caught.
    await page.goto("/admin/children?archived=1");
    await expect(page.getByText(fullName)).toHaveCount(0);

    // The erasure itself must be on the record. This originally failed
    // silently: the audit row referenced the child it had just deleted, hit a
    // foreign key violation, and was dropped by recordAudit's own error
    // handling — leaving a permanent deletion with no trace of who did it.
    await page.goto("/admin/activity");
    await expect(
      visibleText(page, `Permanently deleted ${fullName}`),
    ).toBeVisible();
  });
});

test.describe("accepting an invitation while someone else is signed in", () => {
  test("signs the previous person out instead of landing on their pages", async ({
    page,
  }) => {
    // The owner creates an invitation and stays signed in — exactly what happens
    // when an owner sets up an account at their desk.
    await signIn(page, OWNER);
    await page.goto("/admin/people");

    const email = `handover${Date.now().toString().slice(-6)}@rihana.test`;

    await page.getByRole("button", { name: "Invite a parent" }).click();
    await page.locator("#parent-name").fill("Handover Parent");
    await page.locator("#parent-email").fill(email);
    await page
      .locator("form", { has: page.locator("#parent-name") })
      .getByRole("button", { name: "Create invitation" })
      .click();

    await expect(page.getByText("Invitation link")).toBeVisible();
    const link = await page.locator("code").first().textContent();
    const path = link!.replace(/^https?:\/\/[^/]+/, "");

    // Same browser, still signed in as the owner.
    await page.goto(path);
    await page.getByLabel("Choose a password").fill("newparentpass");
    await page.getByLabel("Confirm password").fill("newparentpass");
    await page.getByRole("button", { name: /Set password/ }).click();

    // Was: bounced to /admin, because the owner's session was still valid and
    // the sign-in page redirects an authenticated visitor to their home.
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByText("Your account is ready")).toBeVisible();

    // The owner's session is genuinely over, not just navigated away from.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe("password policy", () => {
  test("accepts 8 characters", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/people");

    const email = `eight${Date.now().toString().slice(-6)}@rihana.test`;

    await page.getByRole("button", { name: "Invite a parent" }).click();
    await page.locator("#parent-name").fill("Eight Char");
    await page.locator("#parent-email").fill(email);
    await page
      .locator("form", { has: page.locator("#parent-name") })
      .getByRole("button", { name: "Create invitation" })
      .click();

    const link = await page.locator("code").first().textContent();
    await page.goto(link!.replace(/^https?:\/\/[^/]+/, ""));

    await page.getByLabel("Choose a password").fill("abcd1234");
    await page.getByLabel("Confirm password").fill("abcd1234");
    await page.getByRole("button", { name: /Set password/ }).click();

    await expect(page).toHaveURL(/\/signin/);
  });

  test("still rejects 7", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/people");

    const email = `seven${Date.now().toString().slice(-6)}@rihana.test`;

    await page.getByRole("button", { name: "Invite a parent" }).click();
    await page.locator("#parent-name").fill("Seven Char");
    await page.locator("#parent-email").fill(email);
    await page
      .locator("form", { has: page.locator("#parent-name") })
      .getByRole("button", { name: "Create invitation" })
      .click();

    const link = await page.locator("code").first().textContent();
    await page.goto(link!.replace(/^https?:\/\/[^/]+/, ""));

    await page.getByLabel("Choose a password").fill("abcd123");
    await page.getByLabel("Confirm password").fill("abcd123");
    await page.getByRole("button", { name: /Set password/ }).click();

    await expect(page.getByTestId("form-alert")).toContainText(
      "at least 8 characters",
    );
  });
});

test.describe("filters apply as you type", () => {
  test("typing part of a name narrows the roster without submitting", async ({
    page,
  }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    await expect(visibleText(page, "Laila Saeed")).toBeVisible();
    await expect(visibleText(page, "Hana Aziz")).toBeVisible();

    // Three characters, no Enter, no button.
    await page.getByLabel("Search by name").fill("Lai");

    await expect(visibleText(page, "Laila Saeed")).toBeVisible();
    await expect(page.getByText("Hana Aziz")).toHaveCount(0);

    // The URL reflects the filter, so the view is shareable and refreshable.
    await expect(page).toHaveURL(/[?&]q=Lai/);

    // Clearing restores everything.
    await page.getByLabel("Search by name").fill("");
    await expect(visibleText(page, "Hana Aziz")).toBeVisible();
  });

  test("the class filter applies immediately on change", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    // By id: the "Add a child" form also has a Class select in the DOM.
    await page.locator("#classId").selectOption({ label: "Sunflowers" });

    await expect(visibleText(page, "Laila Saeed")).toBeVisible();
    await expect(page.getByText("Hana Aziz")).toHaveCount(0);
  });

  test("live filtering stays inside a teacher's scope", async ({ page }) => {
    // Searching must not become a way around class scoping.
    await signIn(page, TEACHER_SUN);
    await page.goto("/admin/children");

    await page.getByLabel("Search by name").fill("Hana");

    await expect(page.getByText("Hana Aziz")).toHaveCount(0);
  });

  test("searching people applies as you type", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/people");

    await expect(visibleText(page, "amal@rihana.test")).toBeVisible();

    await page.getByLabel("Search").fill("khal");

    await expect(visibleText(page, "khalid@rihana.test")).toBeVisible();
    await expect(page.getByText("amal@rihana.test")).toHaveCount(0);
  });
});
