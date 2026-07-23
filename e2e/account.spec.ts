import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 4: account self-service.
 *
 * These tests own their account. Every seeded parent is load-bearing for some
 * other suite, and a test that changes a shared password leaves the whole run
 * dependent on file order — so the owner invites a throwaway parent here and
 * the assertions below are free to change its password and email.
 */

const OWNER = "owner@rihana.test";
const OWNER_PASSWORD = "ChangeMe!Local123";

const RUN = Date.now().toString().slice(-6);
const EMAIL = `account${RUN}@rihana.test`;
const FIRST_PASSWORD = "firstpass123";
const SECOND_PASSWORD = "secondpass456";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

test.describe("account settings", () => {
  test("the owner creates the account these tests will use", async ({
    page,
  }) => {
    await signIn(page, OWNER, OWNER_PASSWORD);
    await page.waitForURL("/admin");
    await page.goto("/admin/people");

    await page.getByRole("button", { name: "Invite a parent" }).click();
    await page.locator("#parent-name").fill("Account Tester");
    await page.locator("#parent-email").fill(EMAIL);
    await page
      .locator("form", { has: page.locator("#parent-name") })
      .getByRole("button", { name: "Create invitation" })
      .click();

    const link = await page.locator("code").first().textContent();
    await page.goto(link!.replace(/^https?:\/\/[^/]+/, ""));

    await page.getByLabel("Choose a password").fill(FIRST_PASSWORD);
    await page.getByLabel("Confirm password").fill(FIRST_PASSWORD);
    await page.getByRole("button", { name: /Set password/ }).click();

    await expect(page).toHaveURL(/\/signin/);
  });

  test("a parent can update their own name and phone", async ({ page }) => {
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await page.waitForURL("/portal");

    await page.goto("/portal/account");
    await page.getByLabel("Your name").fill("Account Tester Renamed");
    await page.getByLabel("Phone").fill("+20 100 000 0000");
    await page.getByRole("button", { name: "Save details" }).click();

    await expect(visibleText(page, "Your details have been saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Your name")).toHaveValue(
      "Account Tester Renamed",
    );
  });

  test("changing the password requires the current one", async ({ page }) => {
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    await page.getByLabel("Current password").fill("not-the-right-password");
    await page.getByLabel("New password", { exact: true }).fill(SECOND_PASSWORD);
    await page.getByLabel("Confirm new password").fill(SECOND_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(
      visibleText(page, "That is not your current password"),
    ).toBeVisible();

    // And the old password still works, i.e. nothing was changed.
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await expect(page).toHaveURL("/portal");
  });

  test("the new password must be typed twice, and must be new", async ({
    page,
  }) => {
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    await page.getByLabel("Current password").fill(FIRST_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(SECOND_PASSWORD);
    await page.getByLabel("Confirm new password").fill("something-else-entirely");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(visibleText(page, "Those passwords do not match")).toBeVisible();

    // Re-using the current password is not a change.
    await page.getByLabel("Current password").fill(FIRST_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(FIRST_PASSWORD);
    await page.getByLabel("Confirm new password").fill(FIRST_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      visibleText(page, "Choose a password you have not used here before"),
    ).toBeVisible();
  });

  test("a successful change keeps this browser signed in", async ({ page }) => {
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    await page.getByLabel("Current password").fill(FIRST_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(SECOND_PASSWORD);
    await page.getByLabel("Confirm new password").fill(SECOND_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(visibleText(page, "Password changed")).toBeVisible();

    /*
     * The point of this assertion: `setPassword` invalidates every session for
     * the user, including this one. A fresh session is issued in the same
     * action, so the person who just changed their password is not thrown out
     * to the sign-in screen for their trouble.
     */
    await page.goto("/portal/photos");
    await expect(page).toHaveURL("/portal/photos");
  });

  test("the old password no longer works and the new one does", async ({
    page,
  }) => {
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await expect(page).toHaveURL(/\/signin/);

    await signIn(page, EMAIL, SECOND_PASSWORD);
    await expect(page).toHaveURL("/portal");
  });

  test("changing the email requires the password", async ({ page }) => {
    await signIn(page, EMAIL, SECOND_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    const newEmail = `moved${RUN}@rihana.test`;

    await page.getByLabel("Email address").fill(newEmail);
    await page.getByLabel("Your password").fill("wrong-password-entirely");
    await page.getByRole("button", { name: "Change email" }).click();

    await expect(visibleText(page, "That is not your password")).toBeVisible();

    // Still signs in under the original address.
    await signIn(page, EMAIL, SECOND_PASSWORD);
    await expect(page).toHaveURL("/portal");
  });

  test("an email already in use is refused without confirming it exists", async ({
    page,
  }) => {
    await signIn(page, EMAIL, SECOND_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    // A seeded parent's address. The message must not say "that account
    // exists" — this form would otherwise reveal which families attend.
    await page.getByLabel("Email address").fill("amal@rihana.test");
    await page.getByLabel("Your password").fill(SECOND_PASSWORD);
    await page.getByRole("button", { name: "Change email" }).click();

    await expect(
      visibleText(page, "That email address cannot be used"),
    ).toBeVisible();
    await expect(page.getByText(/already (has|in use|registered)/i)).toHaveCount(
      0,
    );
  });

  test("with the right password, the email changes and becomes the login", async ({
    page,
  }) => {
    const newEmail = `moved${RUN}@rihana.test`;

    await signIn(page, EMAIL, SECOND_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    await page.getByLabel("Email address").fill(newEmail);
    await page.getByLabel("Your password").fill(SECOND_PASSWORD);
    await page.getByRole("button", { name: "Change email" }).click();

    await expect(visibleText(page, "Email address updated")).toBeVisible();

    await signIn(page, newEmail, SECOND_PASSWORD);
    await expect(page).toHaveURL("/portal");

    await signIn(page, EMAIL, SECOND_PASSWORD);
    await expect(page).toHaveURL(/\/signin/);
  });
});

