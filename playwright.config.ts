import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // these share one seeded database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // Parents use phones almost exclusively; that is the default viewport.
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      /*
       * The photo suite runs on desktop only.
       *
       * It verifies server-side authorization — who may see which photo — which
       * is identical at every viewport, so a second run proves nothing. It is
       * also by far the slowest suite (real image encoding, real round trips to
       * object storage in another region), and running two projects against one
       * dev server and one database made it contend with itself. Layout at
       * mobile width is covered by screenshots and by the other suites.
       */
      testIgnore: /photos\.spec\.ts/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Reuse a server if one is already running, otherwise start one.
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
