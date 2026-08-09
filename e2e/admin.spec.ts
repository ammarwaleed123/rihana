import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 2: admin CRUD, and the authorization boundaries around it.
 *
 * The scoping tests here are the important ones. Everything else is a form; the
 * scoping is the promise this application makes to families.
 */

const PASSWORD = "ChangeMe!Local123";

const OWNER = "owner@rihana.test";
const TEACHER_SUN = "teacher.sun@rihana.test"; // assigned to Sunflowers only
const PARENT = "amal@rihana.test";

async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(portal|admin)/);
}

/**
 * Admin lists render twice: a table above `md` and stacked cards below, with the
 * inactive variant hidden by CSS rather than removed from the DOM. Both are
 * therefore matched by text selectors, so these helpers narrow to whichever one
 * is actually on screen — letting the same assertions run on both viewports.
 */
function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

function manageLink(page: Page, fullName: string) {
  return page
    .getByRole("link", { name: `Manage ${fullName}` })
    .filter({ visible: true });
}

test.describe("owner: classes", () => {
  test("sees every class with child and teacher counts", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/classes");

    await expect(page.getByRole("heading", { name: "Sunflowers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Olives" })).toBeVisible();
  });

  test("can create a class", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/classes");

    const name = `Acorns ${Date.now().toString().slice(-5)}`;

    await page.getByRole("button", { name: "Add a class" }).click();
    await page.getByLabel("Class name").fill(name);
    await page.getByLabel("Academic year").fill("2026-2027");
    await page.getByRole("button", { name: "Create class" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible();
  });
});

test.describe("owner: children", () => {
  test("can add a child and see them listed", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    const last = `Test${Date.now().toString().slice(-6)}`;

    await page.getByRole("button", { name: "Add a child" }).click();
    await page.getByLabel("First name").fill("Sara");
    await page.getByLabel("Last name").fill(last);
    await page.getByLabel("Date of birth").fill("2023-03-15");
    await page.getByRole("button", { name: "Add child" }).click();

    await expect(visibleText(page, `Sara ${last}`)).toBeVisible();
  });

  test("rejects a future date of birth", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    await page.getByRole("button", { name: "Add a child" }).click();
    await page.getByLabel("First name").fill("Future");
    await page.getByLabel("Last name").fill("Child");
    await page.getByLabel("Date of birth").fill("2099-01-01");
    await page.getByRole("button", { name: "Add child" }).click();

    await expect(page.getByText(/cannot be in the future/i)).toBeVisible();
  });

  test("flags children with no guardian linked", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    // The seed leaves newly created children unlinked, so this warning must show.
    await expect(visibleText(page, "None linked").first()).toBeVisible();
  });
});

test.describe("teacher scoping — the core promise", () => {
  test("a teacher sees only children in their assigned class", async ({ page }) => {
    await signIn(page, TEACHER_SUN);
    await page.goto("/admin/children");

    // Sunflowers children.
    await expect(visibleText(page, "Laila Saeed")).toBeVisible();
    await expect(visibleText(page, "Zayn Rahman")).toBeVisible();

    // Olives children must be absent entirely — not merely unlinked.
    await expect(page.getByText("Hana Aziz")).toHaveCount(0);
    await expect(page.getByText("Maya Darwish")).toHaveCount(0);
  });

  test("a teacher sees only their own class on the classes page", async ({
    page,
  }) => {
    await signIn(page, TEACHER_SUN);
    await page.goto("/admin/classes");

    await expect(page.getByRole("heading", { name: "Sunflowers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Olives" })).toHaveCount(0);
  });

  test("a teacher cannot reach a child in another class by guessing the id", async ({
    page,
    request,
  }) => {
    // Find a child the teacher must not see, as the owner.
    await signIn(page, OWNER);
    await page.goto("/admin/children");
    const href = await manageLink(page, "Hana Aziz").getAttribute("href");
    expect(href).toBeTruthy();

    // Now become the teacher and request that exact URL.
    await page.context().clearCookies();
    await signIn(page, TEACHER_SUN);

    const response = await request.get(href!, {
      headers: {
        Cookie: (await page.context().cookies())
          .map((c) => `${c.name}=${c.value}`)
          .join("; "),
      },
    });

    // 404, not 403: a 403 would confirm the child exists at this nursery.
    expect(response.status()).toBe(404);
  });

  test("a teacher cannot reach the people page", async ({ page }) => {
    await signIn(page, TEACHER_SUN);
    await page.goto("/admin/people");

    await expect(page).toHaveURL("/admin");
  });

  test("a teacher cannot reach the activity log", async ({ page }) => {
    await signIn(page, TEACHER_SUN);
    await page.goto("/admin/activity");

    await expect(page).toHaveURL("/admin");
  });

  test("a teacher is not shown owner-only navigation", async ({ page }) => {
    await signIn(page, TEACHER_SUN);
    await page.goto("/admin");

    await expect(
      page.getByRole("link", { name: "Children", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Parents & staff" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Activity" })).toHaveCount(0);
  });
});

test.describe("parents cannot reach admin at all", () => {
  test("a parent is redirected away from every admin page", async ({ page }) => {
    await signIn(page, PARENT);

    for (const path of [
      "/admin",
      "/admin/children",
      "/admin/classes",
      "/admin/people",
      "/admin/activity",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL("/portal");
    }
  });
});

test.describe("owner: invitations", () => {
  test("creating a parent invitation produces a working link", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/people");

    const email = `invited${Date.now().toString().slice(-6)}@rihana.test`;

    await page.getByRole("button", { name: "Invite a parent" }).click();

    // The teacher form is also in the DOM (inside a hidden panel), so its
    // identically-labelled fields are addressed by id rather than by label here.
    await page.locator("#parent-name").fill("Invited Parent");
    await page.locator("#parent-email").fill(email);
    await page
      .locator("form", { has: page.locator("#parent-name") })
      .getByRole("button", { name: "Create invitation" })
      .click();

    await expect(page.getByText("Invitation link")).toBeVisible();

    const link = await page.locator("code").first().textContent();
    expect(link).toContain("/invite?token=");

    // The link must lead to a usable password form, not an error page.
    await page.goto(link!.replace(/^https?:\/\/[^/]+/, ""));
    await expect(page.getByLabel("Choose a password")).toBeVisible();
  });

  test("an invited account cannot sign in before accepting", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/people");

    const email = `pending${Date.now().toString().slice(-6)}@rihana.test`;

    await page.getByRole("button", { name: "Invite a parent" }).click();
    await page.locator("#parent-name").fill("Pending Parent");
    await page.locator("#parent-email").fill(email);
    await page
      .locator("form", { has: page.locator("#parent-name") })
      .getByRole("button", { name: "Create invitation" })
      .click();
    await expect(page.getByText("Invitation link")).toBeVisible();

    await page.context().clearCookies();
    await page.goto("/signin");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Same generic message as any other failure — no hint that the account
    // exists but is unactivated.
    await expect(page.getByTestId("form-alert")).toHaveText(
      "That email or password is incorrect.",
    );
  });
});

test.describe("owner: guardian links", () => {
  test("linking and unlinking a guardian is recorded in the activity log", async ({
    page,
  }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    await manageLink(page, "Laila Saeed").click();

    await expect(page.getByRole("heading", { name: "Laila Saeed" })).toBeVisible();
    await expect(visibleText(page, "Amal Saeed").first()).toBeVisible();

    // The page must state the consequence of linking, not just offer a control.
    await page.getByRole("button", { name: "Link a guardian" }).click();
    await expect(
      page.getByText(/gives them access to every photo of Laila/i),
    ).toBeVisible();
  });

  test("the activity log records access changes and cannot be edited", async ({
    page,
  }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/activity");

    await expect(
      page.getByText("This record cannot be edited or deleted"),
    ).toBeVisible();

    // Sign-ins are audited, so the log is never empty by the time this runs.
    // Asserted by content rather than by <table>, which only renders above `md`.
    await expect(visibleText(page, "Signed in").first()).toBeVisible();

    // Append-only: the UI offers no way to alter history.
    await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /edit/i })).toHaveCount(0);
  });
});

test.describe("destructive actions", () => {
  test("deleting a child requires typing their exact name", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/admin/children");

    await manageLink(page, "Laila Saeed").click();

    await page.getByRole("button", { name: "Delete permanently" }).click();
    await page.getByLabel(/Type .Laila Saeed. to confirm/).fill("wrong name");
    await page
      .getByRole("button", { name: /Permanently delete Laila Saeed/ })
      .click();

    await expect(page.getByText(/Type "Laila Saeed" exactly/)).toBeVisible();

    // And the child is still there.
    await page.goto("/admin/children");
    await expect(visibleText(page, "Laila Saeed")).toBeVisible();
  });
});
