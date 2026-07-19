/**
 * Capture screenshots of the main pages, signed in as each role.
 *
 * Automated tests assert behaviour; they say nothing about whether a page looks
 * right. This exists so the visual layer gets looked at rather than assumed.
 *
 *   npx tsx scripts/screenshot.ts
 */

import { mkdirSync } from "node:fs";

import { chromium, devices } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3210";
const OUT = "screenshots";
const PASSWORD = "ChangeMe!Local123";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function capture(
  label: string,
  email: string | null,
  paths: Array<{ path: string; name: string }>,
  viewport: "mobile" | "desktop",
) {
  const context = await browser.newContext(
    viewport === "mobile"
      ? devices["Pixel 7"]
      : { viewport: { width: 1280, height: 900 } },
  );
  const page = await context.newPage();

  if (email) {
    await page.goto(`${BASE}/signin`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(portal|admin)/);
  }

  for (const { path, name } of paths) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    const file = `${OUT}/${viewport}-${label}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ${file}`);
  }

  await context.close();
}

console.log("\nCapturing screenshots…\n");

for (const viewport of ["desktop", "mobile"] as const) {
  await capture(
    "public",
    null,
    [
      { path: "/", name: "home" },
      { path: "/signin", name: "signin" },
    ],
    viewport,
  );

  await capture(
    "owner",
    "owner@rihana.test",
    [
      { path: "/admin", name: "overview" },
      { path: "/admin/children", name: "children" },
      { path: "/admin/classes", name: "classes" },
      { path: "/admin/people", name: "people" },
      { path: "/admin/activity", name: "activity" },
    ],
    viewport,
  );

  await capture(
    "teacher",
    "teacher.sun@rihana.test",
    [
      { path: "/admin", name: "overview" },
      { path: "/admin/children", name: "children" },
    ],
    viewport,
  );

  await capture("parent", "amal@rihana.test", [{ path: "/portal", name: "home" }], viewport);
}

await browser.close();
console.log("\nDone.\n");
