/**
 * Diagnose the database connection without printing credentials.
 *
 *   npx tsx scripts/check-db.ts
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

/** Report the shape of a connection string, never its contents. */
function describe(label: string, raw: string | undefined) {
  if (!raw) {
    console.log(`  ${label}: MISSING`);
    return null;
  }

  try {
    const url = new URL(raw);
    const password = decodeURIComponent(url.password ?? "");
    const risky = [...password].filter((c) => "@:/?#[]%&= ".includes(c));

    console.log(`  ${label}:`);
    console.log(`    host      ${url.hostname}`);
    console.log(`    port      ${url.port}`);
    console.log(`    user      ${url.username}`);
    console.log(`    password  ${password.length} characters`);
    if (risky.length > 0) {
      console.log(
        `    WARNING   contains ${risky.length} character(s) that must be URL-encoded: ${[...new Set(risky)].join(" ")}`,
      );
    }
    return url;
  } catch {
    console.log(`  ${label}: NOT A VALID URL — check for unencoded characters`);
    return null;
  }
}

console.log("\nConnection strings as parsed:");
const pooled = describe("DATABASE_URL (app, pooled)", process.env.DATABASE_URL);
const direct = describe("DIRECT_URL (migrations)", process.env.DIRECT_URL);

if (pooled && direct) {
  const samePassword = pooled.password === direct.password;
  console.log(
    `\n  Both URLs use the same password: ${samePassword ? "yes" : "NO — they must match"}`,
  );
}

async function tryConnect(label: string, connectionString: string | undefined) {
  if (!connectionString) return;

  const { Client } = await import("pg");
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000 });

  const started = Date.now();
  try {
    await client.connect();
    const result = await client.query("SELECT current_user, version()");
    console.log(
      `  ${label}: OK in ${Date.now() - started}ms as "${result.rows[0].current_user}"`,
    );
    await client.end();
  } catch (error) {
    const err = error as Error & { code?: string };
    console.log(`  ${label}: FAILED after ${Date.now() - started}ms`);
    console.log(`    code    ${err.code ?? "(none)"}`);
    console.log(`    message ${err.message}`);

    if (/password authentication failed|SASL|SCRAM/i.test(err.message)) {
      console.log(
        "    → The password is wrong, or contains characters that need URL-encoding.",
      );
    } else if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
      console.log("    → The host could not be resolved. Check the hostname.");
    } else if (/timeout/i.test(err.message)) {
      console.log(
        "    → Timed out. Check the project is not paused in the Supabase dashboard.",
      );
    }
  }
}

console.log("\nConnecting:");
await tryConnect("DATABASE_URL", process.env.DATABASE_URL);
await tryConnect("DIRECT_URL", process.env.DIRECT_URL);
console.log("");
