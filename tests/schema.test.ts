import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Schema guardrails.
 *
 * These assert the structural decisions the authorization and scale model depend
 * on. They are cheap, they need no database, and they fail loudly if someone
 * later "tidies up" an index or a uniqueness constraint that is load-bearing.
 *
 * The behavioural authorization tests arrive with the data layer in Phase 3.
 */

const schema = readFileSync(
  resolve(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);

const migrationSql = (() => {
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const dir = resolve(process.cwd(), "prisma/migrations");
  const migrations = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return migrations
    .map((name) => readFileSync(resolve(dir, name, "migration.sql"), "utf8"))
    .join("\n");
})();

describe("hot-path indexes exist in the migration", () => {
  it("indexes a child's photos by recency — the parent album query", () => {
    expect(migrationSql).toMatch(
      /CREATE INDEX .*photo_tags.*"childId", "photoCreatedAt" DESC/,
    );
  });

  it("indexes notifications by recipient, read state and recency", () => {
    expect(migrationSql).toMatch(
      /CREATE INDEX .*notifications.*"userId", "readAt", "createdAt" DESC/,
    );
  });

  it("indexes a class's photos by recency — the class album query", () => {
    expect(migrationSql).toMatch(
      /CREATE INDEX .*photos.*"classId", "createdAt" DESC/,
    );
  });

  it("indexes both sides of the parent-child edge", () => {
    expect(migrationSql).toMatch(/CREATE INDEX .*guardianships.*"parentUserId"/);
    expect(migrationSql).toMatch(/CREATE INDEX .*guardianships.*"childId"/);
  });
});

describe("idempotency constraints exist", () => {
  it("makes double-notifying a parent impossible on job retry", () => {
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX .*notifications.*"userId", "dedupeKey"/,
    );
  });

  it("prevents duplicate emails for the same event", () => {
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX .*outbound_emails.*"dedupeKey"/,
    );
  });

  it("prevents tagging the same child twice in one photo", () => {
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX .*photo_tags.*"photoId", "childId"/,
    );
  });

  it("prevents duplicate guardianship rows", () => {
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX .*guardianships.*"parentUserId", "childId"/,
    );
  });
});

describe("identifiers are non-enumerable", () => {
  it("uses cuid2 for every generated model id, so resources cannot be guessed by counting", () => {
    const idLines = schema
      .split("\n")
      .filter((line) => /^\s*id\s+String\s+@id/.test(line))
      // Session.id is the only id the database does not generate: it is the
      // SHA-256 of the session token, supplied by the application. Asserted
      // separately below.
      .filter((line) => line.includes("@default("));

    expect(idLines.length).toBeGreaterThan(10);
    for (const line of idLines) {
      expect(line).toContain("@default(cuid(2))");
    }
  });

  it("stores session ids without a generated default — they are token hashes", () => {
    const sessionModel = schema.match(/model Session \{[\s\S]*?\n\}/)?.[0];
    expect(sessionModel).toBeDefined();
    // A @default here would mean the app-supplied hash is not what is stored,
    // silently breaking session lookup — and inviting someone to store the raw
    // token instead.
    expect(sessionModel).toMatch(/^\s*id\s+String\s+@id\s*$/m);
  });

  it("declares no autoincrement anywhere", () => {
    expect(schema).not.toContain("autoincrement()");
  });
});

describe("connection configuration", () => {
  it("keeps connection URLs out of the schema file", () => {
    // Prisma 7: URLs belong in prisma.config.ts. A url here would also mean a
    // credential could be committed inside the schema.
    expect(schema).not.toMatch(/url\s*=\s*env\(/);
  });
});
