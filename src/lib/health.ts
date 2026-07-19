import "server-only";

import { prisma } from "@/lib/db";
import { reportError } from "@/lib/logger";

export type HealthReport = {
  status: "ok" | "degraded";
  checks: Record<string, "ok" | "error">;
  latencyMs: number;
  timestamp: string;
};

/**
 * Dependency health.
 *
 * Lives here rather than in the route handler so that the "components never
 * import the Prisma client" boundary holds without exceptions — an exception
 * list is how that rule starts eroding.
 */
export async function checkHealth(): Promise<HealthReport> {
  const startedAt = Date.now();
  const checks: Record<string, "ok" | "error"> = {};
  let healthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (error) {
    checks.database = "error";
    healthy = false;
    reportError(error, { check: "database" });
  }

  return {
    status: healthy ? "ok" : "degraded",
    checks,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };
}
