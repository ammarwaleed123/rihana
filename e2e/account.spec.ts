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
    await page.getByLabel("Phone").fill("01012345678");
    await page.getByRole("button", { name: "Save details" }).click();

    await expect(visibleText(page, "Your details have been saved")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Your name")).toHaveValue(
      "Account Tester Renamed",
    );
    await expect(page.getByLabel("Phone")).toHaveValue("01012345678");
  });

  test("a phone number that is not an Egyptian mobile is rejected", async ({
    page,
  }) => {
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    // The exact complaint: a string of zeros used to be accepted.
    await page.getByLabel("Phone").fill("00000000000");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(visibleText(page, "valid Egyptian mobile")).toBeVisible();

    // A landline-shaped number (no 01 mobile prefix) is refused too.
    await page.getByLabel("Phone").fill("0223456789");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(visibleText(page, "valid Egyptian mobile")).toBeVisible();
  });

  test("the email address is shown but cannot be changed", async ({ page }) => {
    await signIn(page, EMAIL, FIRST_PASSWORD);
    await page.waitForURL("/portal");
    await page.goto("/portal/account");

    // The nursery issues the email; the parent only sees it.
    await expect(visibleText(page, EMAIL)).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change email" })).toHaveCount(
      0,
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
});

