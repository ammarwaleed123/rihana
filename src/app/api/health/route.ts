import { NextResponse } from "next/server";

import { checkHealth } from "@/lib/health";

// Never cached: a health check that can be served from cache is not a health check.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/health
 *
 * Liveness plus a real database round-trip. Returns 503 when a dependency is
 * down, so a load balancer takes the instance out of rotation rather than
 * routing traffic into errors.
 *
 * Reports which dependency is unhealthy, never why — details go to logs.
 */
export async function GET() {
  const report = await checkHealth();

  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
