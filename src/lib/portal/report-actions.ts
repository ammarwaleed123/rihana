"use server";

import { headers } from "next/headers";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { recordAudit } from "@/lib/data/audit";
import { acknowledgeDailyReport } from "@/lib/data/daily-reports";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type AcknowledgeState = { error?: string; done?: boolean };

/**
 * A guardian confirms they have read the day's report.
 *
 * One row per guardian, so two parents each acknowledge for themselves and
 * neither speaks for the other. Idempotent — a double tap is harmless, which
 * matters on a phone.
 */
export async function acknowledgeReportAction(
  _prev: AcknowledgeState,
  formData: FormData,
): Promise<AcknowledgeState> {
  const reportId = String(formData.get("reportId") ?? "");

  try {
    const session = await requireSessionOrThrow();
    const { childId } = await acknowledgeDailyReport(session, reportId);

    const headerList = await headers();
    await recordAudit({
      actor: { id: session.user.id, role: session.user.role },
      ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
      userAgent: headerList.get("user-agent"),
      action: "daily_report.acknowledged",
      summary: "A guardian confirmed they read the daily report",
      childId,
      targetType: "daily_report",
      targetId: reportId,
    });

    return { done: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: error.message };
    if (error instanceof NotFoundError) {
      return { error: "That report is no longer available." };
    }
    logger.error({ err: error, scope: "report-acknowledge" }, "acknowledge failed");
    return { error: "Something went wrong. Please try again." };
  }
}
