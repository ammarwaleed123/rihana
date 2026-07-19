/**
 * Fails the build if a secret is exposed to the browser.
 *
 * Next inlines every NEXT_PUBLIC_-prefixed variable into the client bundle at
 * build time. A secret placed there is public forever — it ships to every
 * visitor and cannot be recalled by rotating the deploy. This check exists
 * because that mistake is quiet: nothing breaks, the value just leaks.
 *
 * Run by `npm run check:secrets` and by `npm run verify`.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Variable-name fragments that must never appear under NEXT_PUBLIC_. */
const FORBIDDEN_NAME_FRAGMENTS = [
  "secret",
  "password",
  "passwd",
  "token",
  "api_key",
  "apikey",
  "access_key",
  "private",
  "credential",
  "dsn",
  "database_url",
  "direct_url",
  "session",
];

/** Value shapes that look like real credentials regardless of the name. */
const SUSPICIOUS_VALUE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "PostgreSQL connection string", pattern: /^postgres(ql)?:\/\/[^/]*:[^@]+@/i },
  { label: "Resend API key", pattern: /^re_[A-Za-z0-9_-]{16,}$/ },
  { label: "AWS access key id", pattern: /^A(KIA|SIA)[A-Z0-9]{16}$/ },
  { label: "JSON web token", pattern: /^ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { label: "PEM private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

type Finding = { source: string; name: string; reason: string };

function parseEnvFile(path: string): Array<[string, string]> {
  if (!existsSync(path)) return [];

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => {
      const index = line.indexOf("=");
      if (index === -1) return [];
      const name = line.slice(0, index).trim();
      const value = line
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      return [[name, value] as [string, string]];
    });
}

function inspect(name: string, value: string, source: string): Finding[] {
  if (!name.startsWith("NEXT_PUBLIC_")) return [];

  const findings: Finding[] = [];
  const haystack = name.toLowerCase();

  for (const fragment of FORBIDDEN_NAME_FRAGMENTS) {
    if (haystack.includes(fragment)) {
      findings.push({
        source,
        name,
        reason: `name contains "${fragment}" — NEXT_PUBLIC_ variables ship to the browser`,
      });
      break;
    }
  }

  if (value) {
    for (const { label, pattern } of SUSPICIOUS_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        findings.push({ source, name, reason: `value looks like a ${label}` });
        break;
      }
    }
  }

  return findings;
}

function main(): void {
  const findings: Finding[] = [];

  for (const file of [".env", ".env.local", ".env.production", ".env.example"]) {
    for (const [name, value] of parseEnvFile(resolve(process.cwd(), file))) {
      findings.push(...inspect(name, value, file));
    }
  }

  for (const [name, value] of Object.entries(process.env)) {
    findings.push(...inspect(name, value ?? "", "process.env"));
  }

  if (findings.length > 0) {
    console.error("\n  Secret exposure check FAILED\n");
    for (const { source, name, reason } of findings) {
      // The offending value is never printed — that would just move the leak.
      console.error(`  ${name}  (${source})\n    ${reason}\n`);
    }
    console.error(
      "  Remove the NEXT_PUBLIC_ prefix and read the value on the server instead.\n",
    );
    process.exit(1);
  }

  console.log("Secret exposure check passed — no secrets reachable from the client bundle.");
}

main();
