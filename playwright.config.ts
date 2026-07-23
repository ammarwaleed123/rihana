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

  /*
   * 10s per assertion, up from Playwright's 5s default.
   *
   * Every wait here is on a server action that writes and then revalidates,
   * against a single dev server shared by the whole run. Sign-in in particular
   * does argon2id verification, which is deliberately slow. At 105 tests 5s
   * held; at 140 it started flaking two assertions per full run while passing
   * every one of them in isolation — the timeout was measuring contention, not
   * the app. The storage-heavy photo and album suites raise it further on the
   * individual waits that do real round trips to object storage.
   */
  expect: { timeout: 10_000 },

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
       * The photo, album and account suites run on desktop only.
       *
       * They verify server-side behaviour — who may see which photo, when a
       * photo becomes published, who may change an email — which is identical
       * at every viewport, so a second run proves nothing. They are also by far
       * the slowest (real image encoding, real round trips to object storage in
       * another region), and running two projects against one dev server and
       * one database made them contend with each other.
       *
       * The account suite has a second reason: it invites a throwaway account
       * whose address is derived from the module's load time, and running the
       * same module under two projects would try to invite that address twice.
       *
       * Layout at mobile width is covered by screenshots and by the other
       * suites — including the portal tab-bar assertions in regressions.spec.
       */
      testIgnore:
        /photos\.spec\.ts|photo-regressions\.spec\.ts|albums\.spec\.ts|account\.spec\.ts|notifications\.spec\.ts/,
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
