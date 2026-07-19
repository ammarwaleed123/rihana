import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env, isProduction } from "@/lib/env";

/**
 * The Prisma client.
 *
 * IMPORTANT: importing this module outside `src/lib/data/` is an ESLint error.
 * Scoped reads must go through the data layer so authorization cannot be
 * forgotten in a component. See docs/architecture.md.
 *
 * Prisma 7 constructs the client with a driver adapter rather than a URL in the
 * schema. We point it at the pooled connection (pgbouncer, :6543) — app servers
 * are stateless and horizontally scaled, so they must not each hold a fan of
 * direct Postgres connections. Migrations use DIRECT_URL instead; see
 * prisma.config.ts.
 */

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: isProduction
      ? [{ emit: "event", level: "error" }]
      : [
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
        ],
  });
}

// In development, Next's hot reload re-evaluates modules on every edit. Without
// this cache each reload would open a new pool and exhaust Postgres connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
