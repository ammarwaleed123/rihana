import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection configuration out of schema.prisma and into this file.
 *
 * Next.js reads `.env.local` first and falls back to `.env`; plain dotenv only
 * reads `.env`. We replicate Next's precedence here so the CLI and the app never
 * disagree about which database they are pointed at. `override: false` keeps real
 * environment variables (CI, Vercel) authoritative over any local file.
 */
for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

/**
 * Migrations run over DIRECT_URL (port 5432), never over the pooled connection:
 * Supabase's transaction pooler cannot hold the advisory locks and session-level
 * DDL state Prisma Migrate depends on. The application itself uses the pooled
 * DATABASE_URL via the driver adapter in src/lib/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    url: process.env.DIRECT_URL,
  },

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
