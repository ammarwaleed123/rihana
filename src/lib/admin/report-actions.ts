"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { recordAudit } from "@/lib/data/audit";
import {
  markChildAbsent,
  publishDailyReport,
  saveDailyReport,
} from "@/lib/data/daily-reports";
import type { MissingField } from "@/lib/data/report-rules";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  MEALS,
  MEAL_AMOUNTS,
  PLAY_AREAS,
  dailyReportInput,
  fieldErrors,
} from "@/lib/validation";

export type ReportState = {
  error?: string;
  success?: string;
  errors?: Record<string, string>;
  /** What is still stopping this report going home, for the interface to name. */
  missing?: MissingField[];
};

async function context(session: Session) {
  const headerList = await headers();
  return {
    actor: { id: session.user.id, role: session.user.role },
    ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
  };
}

function toState(error: unknown, scope: string): ReportState {
  if (error instanceof ForbiddenError) return { error: error.message };
  if (error instanceof NotFoundError) {
    return { error: "That report no longer exists." };
  }
  logger.error({ err: error, scope }, "daily report action failed");
  return { error: "Something went wrong. Please try again." };
}

function bool(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Read the form.
 *
 * Meals and toilet lines arrive as flat, indexed fields rather than nested
 * structures, because that is what a plain HTML form can express — and this form
 * must keep working when JavaScript has not loaded, on a teacher's phone in a
 * classroom with poor signal.
 */
function parse(formData: FormData) {
  const meals = MEALS.map((meal) => {
    const raw = str(formData, `meal_${meal}_amount`);
    const amount = (MEAL_AMOUNTS as readonly string[]).includes(raw)
      ? (raw as (typeof MEAL_AMOUNTS)[number])
      : null;
    return {
      meal,
      amount,
      description: str(formData, `meal_${meal}_description`),
    };
  });

  const toiletEntries: Array<{
    time: string;
    wet: boolean;
    bm: boolean;
    accident: boolean;
  }> = [];

  for (let index = 0; index < 5; index++) {
    const time = str(formData, `toilet_${index}_time`).trim();
    const wet = bool(formData, `toilet_${index}_wet`);
    const bm = bool(formData, `toilet_${index}_bm`);
    const accident = bool(formData, `toilet_${index}_accident`);
    // A line with no time is an empty line, not a record of nothing.
    if (!time && !wet && !bm && !accident) continue;
    toiletEntries.push({ time, wet, bm, accident });
  }

  const playAreas = formData
    .getAll("playAreas")
    .filter((v): v is string => typeof v === "string")
    .filter((v) => (PLAY_AREAS as readonly string[]).includes(v));

  return dailyReportInput.safeParse({
    arrivalTime: str(formData, "arrivalTime"),
    playAreas,
    alsoEnjoyed: str(formData, "alsoEnjoyed"),
    quranMemorised: str(formData, "quranMemorised"),
    quranRevision: str(formData, "quranRevision"),
    littleMuslim: str(formData, "littleMuslim"),
    meals,
    napNone: bool(formData, "napNone"),
    napFrom: str(formData, "napFrom"),
    napUntil: str(formData, "napUntil"),
    toiletNothingToRecord: bool(formData, "toiletNothingToRecord"),
    toiletEntries,
    bringCleanClothes: bool(formData, "bringCleanClothes"),
    bringDiapers: bool(formData, "bringDiapers"),
    bringOther: str(formData, "bringOther"),
    teacherComments: str(formData, "teacherComments"),
  });
}

/** Empty string means "not filled in yet", which is null in the database. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function persist(
  session: Session,
  reportId: string,
  parsed: ReturnType<typeof parse>,
) {
  if (!parsed.success) throw parsed.error;
  const input = parsed.data;

  return saveDailyReport(session, reportId, {
    arrivalTime: orNull(input.arrivalTime),
    playAreas: input.playAreas,
    alsoEnjoyed: orNull(input.alsoEnjoyed),
    quranMemorised: orNull(input.quranMemorised),
    quranRevision: orNull(input.quranRevision),
    littleMuslim: orNull(input.littleMuslim),
    napNone: input.napNone,
    napFrom: orNull(input.napFrom),
    napUntil: orNull(input.napUntil),
    toiletNothingToRecord: input.toiletNothingToRecord,
    bringCleanClothes: input.bringCleanClothes,
    bringDiapers: input.bringDiapers,
    bringOther: orNull(input.bringOther),
    teacherComments: orNull(input.teacherComments),
    meals: input.meals
      .filter((m): m is typeof m & { amount: NonNullable<typeof m.amount> } =>
        m.amount !== null,
      )
      .map((m) => ({
        meal: m.meal,
        amount: m.amount,
        description: orNull(m.description),
      })),
    toiletEntries: input.toiletEntries,
  });
}

export async function saveReportAction(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const reportId = String(formData.get("reportId") ?? "");

  try {
    const session = await requireSessionOrThrow();
    const parsed = parse(formData);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    const { wasPublished } = await persist(session, reportId, parsed);

    /*
     * Only the class list. Revalidating this child's own page remounts the
     * form, which discards the action result — so the teacher was shown the
     * stale "still missing" list instead of a confirmation, in the same instant
     * the report went home. The form clears that list from the action result,
     * and the page's own server-rendered notice covers a reload.
     */
    revalidatePath("/admin/reports");
    return { success: wasPublished ? "resent" : "saved" };
  } catch (error) {
    return toState(error, "report-save");
  }
}

/**
 * Save, then send home.
 *
 * Saving first is deliberate: a teacher who fills the last field and taps
 * "Send home" expects that field to count. Publishing what was last saved rather
 * than what is on screen would silently drop it.
 */
export async function publishReportAction(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const reportId = String(formData.get("reportId") ?? "");

  try {
    const session = await requireSessionOrThrow();
    const parsed = parse(formData);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    await persist(session, reportId, parsed);
    const result = await publishDailyReport(session, reportId);

    if (!result.published) {
      return { missing: result.missing };
    }

    await recordAudit({
      ...(await context(session)),
      action: result.wasAlreadyPublished
        ? "daily_report.updated"
        : "daily_report.published",
      summary: `${result.wasAlreadyPublished ? "Updated" : "Sent home"} the daily report for ${result.report.child.firstName} ${result.report.child.lastName}`,
      childId: result.report.childId,
      targetType: "daily_report",
      targetId: reportId,
    });

    /*
     * Only the class list. Revalidating this child's own page remounts the
     * form, which discards the action result — so the teacher was shown the
     * stale "still missing" list instead of a confirmation, in the same instant
     * the report went home. The form clears that list from the action result,
     * and the page's own server-rendered notice covers a reload.
     */
    revalidatePath("/admin/reports");
    return { success: result.wasAlreadyPublished ? "resent" : "sentHome" };
  } catch (error) {
    return toState(error, "report-publish");
  }
}

export async function markAbsentAction(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const reportId = String(formData.get("reportId") ?? "");

  try {
    const session = await requireSessionOrThrow();
    const report = await markChildAbsent(session, reportId);

    await recordAudit({
      ...(await context(session)),
      action: "daily_report.absent",
      summary: `Marked ${report.child.firstName} ${report.child.lastName} absent`,
      childId: report.childId,
      targetType: "daily_report",
      targetId: reportId,
    });

    /*
     * Only the class list. Revalidating this child's own page remounts the
     * form, which discards the action result — so the teacher was shown the
     * stale "still missing" list instead of a confirmation, in the same instant
     * the report went home. The form clears that list from the action result,
     * and the page's own server-rendered notice covers a reload.
     */
    revalidatePath("/admin/reports");
    return { success: "markedAbsent" };
  } catch (error) {
    return toState(error, "report-absent");
  }
}
