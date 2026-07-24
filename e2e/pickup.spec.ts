import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 6: pickup authorization.
 *
 * The safety-critical flow: a parent proposes someone, an owner approves, and
 * only then does that person reach the door board. Plus the bus choice, the
 * rejection path, and the scope rule that a parent sees only their own children.
 *
 * Approval writes status directly, so most of this needs no worker. The one
 * notification assertion (a parent is told their request was approved) does —
 * it polls, the same shape the photo and announcement suites use.
 */

const PASSWORD = "ChangeMe!Local123";
const OWNER = "owner@rihana.test";
const AMAL = "amal@rihana.test"; // Laila (Sunflowers), Omar (Olives, seeded BUS)
const KHALID = "khalid@rihana.test"; // Zayn (Sunflowers)

test.describe.configure({ mode: "serial", timeout: 180_000 });

const RUN = Date.now().toString().slice(-6);
const AUNT = `Aunt ${RUN}`;
const STRANGER = `Visitor ${RUN}`;

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(portal|admin)/);
}

/** Open a child's pickup page from the overview by the child's name. */
async function openChild(page: Page, childName: RegExp) {
  await page.goto("/portal/pickup");
  await page.getByRole("link", { name: childName }).click();
  await page.waitForURL(/\/portal\/pickup\/[a-z0-9]+/);
}

/** Fill and submit the "Add someone" form (scoped so its password is unambiguous). */
async function addPerson(
  page: Page,
  person: { name: string; relationship: string; phone: string },
) {
  const form = page.locator("form", {
    has: page.getByRole("button", { name: "Send for approval" }),
  });
  await form.getByLabel("Full name").fill(person.name);
  await form.getByLabel("Relationship to the child").fill(person.relationship);
  await form.getByLabel("Phone number").fill(person.phone);
  await form.getByLabel("Confirm your password").fill(PASSWORD);
  await form.getByRole("button", { name: "Send for approval" }).click();
}

test.describe("adding and approving", () => {
  test("a parent proposes someone, the owner approves, and they reach the board", async ({
    page,
  }) => {
    // Amal proposes an aunt for Laila.
    await signIn(page, AMAL);
    await openChild(page, /Laila Saeed/);
    await addPerson(page, {
      name: AUNT,
      relationship: "Aunt",
      phone: "01012345678",
    });

    // Back on Laila's page, awaiting approval.
    await expect(page.getByText("Sent to the nursery for approval")).toBeVisible();
    const row = page.locator("li", { hasText: AUNT });
    await expect(row.getByText("Awaiting approval")).toBeVisible();

    // She is NOT yet on the door board (approval is the gate).
    await signIn(page, OWNER);
    await page.goto("/admin/pickup");
    const boardCard = page.locator("li", { hasText: "Laila Saeed" });
    await expect(boardCard.getByText(AUNT)).toHaveCount(0);

    // The owner approves her from the queue.
    await page.goto("/admin/pickup/approvals");
    const queueRow = page.locator("li", { hasText: AUNT });
    await queueRow.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("They can now collect the child")).toBeVisible();

    // Now she is on the board under Laila.
    await page.goto("/admin/pickup");
    await expect(
      page.locator("li", { hasText: "Laila Saeed" }).getByText(AUNT),
    ).toBeVisible();
  });

  test("the parent is notified their request was approved", async ({ page }) => {
    // Needs the worker running (fan-out is off-request).
    await signIn(page, AMAL);
    await expect(async () => {
      await page.goto("/portal/notifications");
      await expect(
        page.getByText(/Pickup authorized/i).first(),
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 90_000 });

    // And on Laila's page she now reads as approved.
    await openChild(page, /Laila Saeed/);
    await expect(
      page.locator("li", { hasText: AUNT }).getByText("Approved", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("rejection", () => {
  test("a turned-down request shows its reason to the parent", async ({ page }) => {
    await signIn(page, AMAL);
    await openChild(page, /Laila Saeed/);
    await addPerson(page, {
      name: STRANGER,
      relationship: "Unknown",
      phone: "01087654321",
    });
    await expect(page.getByText("Sent to the nursery for approval")).toBeVisible();

    // Owner rejects with a reason.
    await signIn(page, OWNER);
    await page.goto("/admin/pickup/approvals");
    const queueRow = page.locator("li", { hasText: STRANGER });
    await queueRow.getByLabel("Reason (optional)").fill("Not on our approved list");
    await queueRow.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("The parent has been notified")).toBeVisible();

    // The parent sees "Not approved" and the reason.
    await signIn(page, AMAL);
    await openChild(page, /Laila Saeed/);
    const row = page.locator("li", { hasText: STRANGER });
    await expect(row.getByText("Not approved")).toBeVisible();
    await expect(row.getByText("Not on our approved list")).toBeVisible();
  });
});

test.describe("the bus choice", () => {
  test("choosing the nursery bus shows on the board and hides pickup people", async ({
    page,
  }) => {
    await signIn(page, AMAL);
    await openChild(page, /Laila Saeed/);

    // Switch Laila to the bus (scoped to the method form so its password field
    // is the right one).
    const methodForm = page.locator("form", {
      has: page.getByRole("button", { name: "Save arrangement" }),
    });
    await methodForm.getByRole("radio", { name: /Nursery bus/ }).check();
    await methodForm.getByLabel("Confirm your password").fill(PASSWORD);
    await methodForm.getByRole("button", { name: "Save arrangement" }).click();

    // Match the bus card's heading specifically: the method radio label, its
    // description, and the success alert all also contain "nursery bus", so a
    // bare substring would resolve to several elements.
    await expect(
      page.getByRole("heading", { name: "Nursery bus" }),
    ).toBeVisible();
    // The "Add someone" form is gone now that no door people are needed.
    await expect(
      page.getByRole("button", { name: "Send for approval" }),
    ).toHaveCount(0);

    // The board shows Laila as a bus rider. Match the emoji badge specifically —
    // the same card also says "Goes home on the nursery bus.", so a bare
    // "Nursery bus" substring would match two elements in the card.
    await signIn(page, OWNER);
    await page.goto("/admin/pickup");
    await expect(
      page.locator("li", { hasText: "Laila Saeed" }).getByText("🚌 Nursery bus"),
    ).toBeVisible();
  });
});

test.describe("scope", () => {
  test("a parent sees only their own children", async ({ page }) => {
    await signIn(page, KHALID);
    await page.goto("/portal/pickup");
    await expect(page.getByRole("link", { name: /Zayn/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Laila/ })).toHaveCount(0);
  });
});
