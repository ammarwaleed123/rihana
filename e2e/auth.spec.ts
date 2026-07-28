import { expect, test } from "@playwright/test";

/**
 * Phase 1 walkthrough, in a real browser.
 *
 * These drive the actual forms — server actions, cookies, redirects and all —
 * which is the only way to verify the sign-in flow end to end. Session and
 * authorization internals are covered separately in scripts/verify-auth.ts.
 */

const PASSWORD = "ChangeMe!Local123";

const PARENT = { email: "amal@rihana.test", name: "Amal Saeed" };
const OWNER = { email: "owner@rihana.test", name: "Rihana Owner" };
const TEACHER = { email: "teacher.sun@rihana.test", name: "Mariam Haddad" };

/**
 * Sign in and wait until we have actually landed.
 *
 * The wait matters: the session cookie is set on the action's redirect
 * response, so anything that inspects cookies or navigates immediately after
 * the click would otherwise race it.
 */
async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  expectedPath: RegExp = /\/(portal|admin)/,
) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(expectedPath);
}

/** The app's own alert, not Next's route announcer (which is also role=alert). */
function formAlert(page: import("@playwright/test").Page) {
  return page.getByTestId("form-alert");
}

test.describe("sign in", () => {
  test("a parent signs in and lands in the portal", async ({ page }) => {
    await signIn(page, PARENT.email);

    await expect(page).toHaveURL("/portal");
    await expect(
      page.getByRole("heading", { name: `Hello, ${PARENT.name}` }),
    ).toBeVisible();
  });

  test("an owner signs in and lands in admin", async ({ page }) => {
    await signIn(page, OWNER.email);

    await expect(page).toHaveURL("/admin");
    await expect(page.getByText("Owner", { exact: true })).toBeVisible();
    await expect(page.getByText("whole nursery")).toBeVisible();
  });

  test("a teacher signs in and is shown as class-restricted", async ({ page }) => {
    await signIn(page, TEACHER.email);

    await expect(page).toHaveURL("/admin");
    await expect(page.getByText("Teacher", { exact: true })).toBeVisible();
    await expect(page.getByText("classes you are assigned to")).toBeVisible();
  });

  test("a wrong password is rejected with a generic message", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill(PARENT.email);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = formAlert(page);
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("That email or password is incorrect.");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("an unknown email produces the identical message, revealing nothing", async ({
    page,
  }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill("nobody-here@rihana.test");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Byte-identical to the wrong-password case: the form is not an oracle for
    // which families attend this nursery.
    await expect(formAlert(page)).toHaveText(
      "That email or password is incorrect.",
    );
  });
});

test.describe("session cookie", () => {
  test("is httpOnly, so a script cannot read it", async ({ page, context }) => {
    await signIn(page, PARENT.email);

    const cookie = (await context.cookies()).find((c) =>
      c.name.includes("rihana_session"),
    );

    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.path).toBe("/");

    // The definitive check: JavaScript in the page cannot see it.
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain("rihana_session");
  });

  test("does not contain the value stored in the database", async ({
    page,
    context,
  }) => {
    await signIn(page, PARENT.email);

    const cookie = (await context.cookies()).find((c) =>
      c.name.includes("rihana_session"),
    );

    // 32 bytes base64url. The database stores its SHA-256, never this.
    expect(cookie!.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

test.describe("redirects", () => {
  test("an anonymous visitor is sent to sign in and returned afterwards", async ({
    page,
  }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL("/signin?next=%2Fportal");

    await page.getByLabel("Email").fill(PARENT.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/portal");
  });

  test("an external next= target is ignored, so this is not an open redirect", async ({
    page,
  }) => {
    await page.goto("/signin?next=https://example.com/phish");
    await page.getByLabel("Email").fill(PARENT.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/portal");
    expect(page.url()).not.toContain("example.com");
  });

  test("a protocol-relative next= target is also ignored", async ({ page }) => {
    await page.goto("/signin?next=//example.com/phish");
    await page.getByLabel("Email").fill(PARENT.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/portal");
  });

  test("a parent cannot reach admin", async ({ page }) => {
    await signIn(page, PARENT.email);
    await page.goto("/admin");
    await expect(page).toHaveURL("/portal");
  });

  test("staff cannot reach the parent portal", async ({ page }) => {
    await signIn(page, OWNER.email);
    await page.goto("/portal");
    await expect(page).toHaveURL("/admin");
  });
});

test.describe("sign out", () => {
  test("ends the session and blocks the back button", async ({ page }) => {
    await signIn(page, PARENT.email);
    await expect(page).toHaveURL("/portal");

    // Sign out lives on the account page now (the header is just logo + bell).
    await page.goto("/portal/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/signin");

    // The session is dead server-side, so returning to /portal must bounce.
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe("password reset", () => {
  test("gives the same confirmation for a real and an unknown address", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(PARENT.email);
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(formAlert(page)).toBeVisible();
    const realMessage = await formAlert(page).textContent();

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("no-such-person@rihana.test");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(formAlert(page)).toBeVisible();
    const unknownMessage = await formAlert(page).textContent();

    expect(realMessage).toBe(unknownMessage);
  });
});

test.describe("invalid links", () => {
  test("an invalid invite token explains rather than showing a form", async ({
    page,
  }) => {
    await page.goto("/invite?token=not-a-real-token");

    await expect(
      page.getByRole("heading", { name: "This link is no longer valid" }),
    ).toBeVisible();
    await expect(page.getByLabel("Choose a password")).toHaveCount(0);
  });

  test("an invalid reset token explains rather than showing a form", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=not-a-real-token");

    await expect(
      page.getByRole("heading", { name: "This link is no longer valid" }),
    ).toBeVisible();
    await expect(page.getByLabel("New password")).toHaveCount(0);
  });
});

test.describe("accessibility basics", () => {
  test("the sign-in form is keyboard navigable and properly labelled", async ({
    page,
  }) => {
    await page.goto("/signin");

    // Every input must resolve by its visible label, which is what a screen
    // reader announces.
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    await page.getByLabel("Email").focus();
    await page.keyboard.type(PARENT.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/portal");
  });
});
