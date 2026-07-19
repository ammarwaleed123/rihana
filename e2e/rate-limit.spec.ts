import { expect, test } from "@playwright/test";

/**
 * Rate limiting and account lockout.
 *
 * Kept in its own file because these tests deliberately burn the sign-in
 * allowance for an address, which would poison any test running after them.
 * They use a dedicated account that nothing else touches.
 *
 * Runs serially against a shared bucket, so the whole file is one sequence.
 */

test.describe.configure({ mode: "serial" });

const VICTIM = "khalid@rihana.test";
const WRONG = "not-the-right-password";

test("repeated wrong passwords eventually trip the rate limit", async ({
  page,
}) => {
  // RATE_LIMIT_LOGIN_MAX is 8 in .env.local; go past it.
  let sawRateLimit = false;

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    await page.goto("/signin");
    await page.getByLabel("Email").fill(VICTIM);
    await page.getByLabel("Password").fill(WRONG);
    await page.getByRole("button", { name: "Sign in" }).click();

    const message = await page.getByTestId("form-alert").textContent();

    if (message?.includes("Too many sign-in attempts")) {
      sawRateLimit = true;
      // The message must say when to come back, not just refuse.
      expect(message).toMatch(/try again in \d+ minutes/i);
      break;
    }

    expect(message).toBe("That email or password is incorrect.");
  }

  expect(
    sawRateLimit,
    "expected the rate limit to fire within 12 attempts",
  ).toBe(true);
});

test("the rate limit still blocks even with the correct password", async ({
  page,
}) => {
  // The previous test exhausted the bucket for this address. A correct password
  // must not be a way around the limit — otherwise the limit only slows down
  // attackers who are still guessing, and stops nobody who has just succeeded.
  await page.goto("/signin");
  await page.getByLabel("Email").fill(VICTIM);
  await page.getByLabel("Password").fill("ChangeMe!Local123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByTestId("form-alert")).toContainText(
    "Too many sign-in attempts",
  );
  await expect(page).toHaveURL(/\/signin/);
});

test("a different address is unaffected by another's exhausted bucket", async ({
  page,
}) => {
  // Per-account buckets must not become a denial-of-service against everyone
  // else. (Both accounts share this test's IP, so this also proves the IP
  // bucket is scoped generously enough not to lock out a whole household.)
  await page.goto("/signin");
  await page.getByLabel("Email").fill("sami@rihana.test");
  await page.getByLabel("Password").fill("ChangeMe!Local123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/portal");
});
