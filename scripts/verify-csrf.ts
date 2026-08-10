/**
 * Can another website act on a signed-in parent's behalf?
 *
 * The real test, not an inferred one. Stands up an attacker origin on another
 * port, signs a browser into the app, then loads the attacker page and lets it
 * submit a cross-site form POST at a Server Action. Two things must hold: the
 * session cookie must not travel with that request, and the action must not run.
 *
 * Asserting "SameSite=Lax is set" would not be the same test. That checks our
 * intent; this checks the browser's behaviour, which is what actually protects a
 * parent. The cookie's attributes are recorded too, since SameSite is the
 * control doing most of the work.
 *
 *   npx tsx scripts/verify-csrf.ts
 *
 * Needs the app running (VERIFY_BASE_URL, default http://localhost:3120).
 * Creates nothing and leaves nothing behind; it only reads, and asserts that a
 * write did NOT happen.
 */

import { createServer } from "node:http";

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { chromium } = await import("@playwright/test");

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3120";
const PASSWORD = process.env.VERIFY_PASSWORD ?? "ChangeMe!Local123";
const PARENT = process.env.VERIFY_PARENT_EMAIL ?? "amal@rihana.test";
const ATTACKER_PORT = Number(process.env.VERIFY_ATTACKER_PORT ?? 4599);

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** What the app actually received from the cross-site attempt. */
const seen: { cookie?: string } = {};

/*
 * The attacker page. It targets the account form, whose action changes the
 * interface language — a visible, harmless, easily-asserted effect. If CSRF were
 * possible here it would be possible on the destructive actions too.
 */
const attacker = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!doctype html>
    <p>attacker</p>
    <form id="f" method="POST" action="${BASE}/portal/account">
      <input name="locale" value="ar">
      <input name="returnTo" value="/portal/account">
    </form>
    <script>document.getElementById("f").submit()</script>`);
});

async function main() {
  await new Promise<void>((resolve) => attacker.listen(ATTACKER_PORT, resolve));
  console.log(
    `\nCSRF (app ${BASE}, attacker http://localhost:${ATTACKER_PORT})\n`,
  );

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/signin`);
    await page.getByLabel("Email").fill(PARENT);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/portal");

    /*
     * Read the starting language rather than assuming English: the account may
     * legitimately be on Arabic from earlier use. What matters is that the
     * attacker cannot CHANGE it, not which value it holds.
     */
    await page.goto(`${BASE}/portal/account`);
    const before = await page.locator("html").getAttribute("dir");

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name.includes("rihana_session"));
    check("a session cookie exists after signing in", Boolean(session));
    check(
      "the session cookie is httpOnly (a script cannot read it)",
      session?.httpOnly === true,
    );
    check(
      "the session cookie is SameSite=Lax, so a cross-site POST cannot carry it",
      session?.sameSite === "Lax",
      `sameSite=${session?.sameSite}`,
    );

    page.on("request", (request) => {
      if (
        request.url().startsWith(`${BASE}/portal/account`) &&
        request.method() === "POST"
      ) {
        seen.cookie = request.headers()["cookie"] ?? "";
      }
    });

    await page.goto(`http://localhost:${ATTACKER_PORT}/`);
    await page.waitForTimeout(2500);

    /*
     * A POST must actually have been observed. If the attacker's form never
     * fired, every assertion below would pass for the wrong reason — the
     * strongest-looking result this script can produce is also its likeliest
     * false negative.
     */
    check("the attacker's cross-site POST did reach the app", seen.cookie !== undefined);
    check(
      "…and it did not carry the session cookie",
      seen.cookie !== undefined && !seen.cookie.includes("rihana_session"),
      seen.cookie === undefined
        ? "no POST observed — nothing was tested"
        : `cookies sent: ${seen.cookie === "" ? "(none)" : seen.cookie}`,
    );

    await page.goto(`${BASE}/portal/account`);
    const after = await page.locator("html").getAttribute("dir");
    check(
      "the attacker's attempt did not change the account",
      after === before,
      `dir ${before} -> ${after}`,
    );
  } finally {
    await browser.close();
    attacker.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
