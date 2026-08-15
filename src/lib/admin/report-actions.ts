"use server";

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
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import {
  MEALS,
  MEAL_AMOUNTS,
  PLAY_AREAS,
  dailyReportInput,
  fieldErrors,
} from "@/lib/validation";

/*
 * No revalidatePath here, deliberately.
 *
 * Every admin route is dynamic, so the class list re-queries on each visit and
 * has nothing to invalidate. Calling it anyway invalidated this page's own
 * segment, which reset the form's action state AND left the stale server render
 * in place — so a teacher who sent a report home was shown the old "still
 * missing" list instead of a confirmation. Two mechanisms fighting over the same
 * screen, neither winning.
 */
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

/**
 * The fields this teacher actually changed.
 *
 * Two teachers fill one report at the same time — the Qur'an teacher does her
 * section, someone else records meals. If every save carried the whole form,
 * whoever saved last would overwrite the rest with their own, older picture of
 * the day: a nap recorded at 13:00 wiped by a lunch entry at 14:05, silently.
 *
 * So a save applies only what was touched, and stays silent about everything
 * else. Deliberate corrections to another teacher's entry still work — she has
 * to actually change the field, which marks it.
 *
 * An empty list is treated as "everything", so a form submitted without
 * JavaScript still saves rather than doing nothing at all.
 */
function changedSet(formData: FormData): (field: string) => boolean {
  const raw = str(formData, "changedFields").trim();
  if (raw === "") return () => true;
  const fields = new Set(raw.split(",").filter(Boolean));
  return (field: string) => fields.has(field);
}

async function persist(
  session: Session,
  reportId: string,
  parsed: ReturnType<typeof parse>,
  formData: FormData,
) {
  if (!parsed.success) throw parsed.error;
  const input = parsed.data;
  const touched = changedSet(formData);

  const pick = <V,>(field: string, value: V): V | undefined =>
    touched(field) ? value : undefined;

  const meals = input.meals
    .filter((m): m is typeof m & { amount: NonNullable<typeof m.amount> } =>
      m.amount !== null,
    )
    // A meal row is only written if its amount or its description was touched.
    .filter(
      (m) =>
        touched(`meal_${m.meal}_amount`) || touched(`meal_${m.meal}_description`),
    )
    .map((m) => ({
      meal: m.meal,
      amount: m.amount,
      description: orNull(m.description),
    }));

  return saveDailyReport(session, reportId, {
    arrivalTime: pick("arrivalTime", orNull(input.arrivalTime)),
    playAreas: pick("playAreas", input.playAreas),
    alsoEnjoyed: pick("alsoEnjoyed", orNull(input.alsoEnjoyed)),
    quranMemorised: pick("quranMemorised", orNull(input.quranMemorised)),
    quranRevision: pick("quranRevision", orNull(input.quranRevision)),
    littleMuslim: pick("littleMuslim", orNull(input.littleMuslim)),
    napNone: pick("napNone", input.napNone),
    napFrom: pick("napFrom", orNull(input.napFrom)),
    napUntil: pick("napUntil", orNull(input.napUntil)),
    toiletNothingToRecord: pick(
      "toiletNothingToRecord",
      input.toiletNothingToRecord,
    ),
    bringCleanClothes: pick("bringCleanClothes", input.bringCleanClothes),
    bringDiapers: pick("bringDiapers", input.bringDiapers),
    bringOther: pick("bringOther", orNull(input.bringOther)),
    teacherComments: pick("teacherComments", orNull(input.teacherComments)),
    meals: meals.length > 0 ? meals : undefined,
    toiletEntries: pick("toiletEntries", input.toiletEntries),
  });
}

async function runSave(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const reportId = String(formData.get("reportId") ?? "");

  try {
    const session = await requireSessionOrThrow();
    const parsed = parse(formData);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    const { wasPublished } = await persist(session, reportId, parsed, formData);

    /*
     * Editing a report the family has already read is a thing they must be told
     * about — the interface says "the family has been told it changed", and that
     * sentence has to be true. Saving a draft tells nobody: the report has not
     * gone home yet.
     */
    if (wasPublished) {
      await enqueue(QUEUES.notifyDailyReport, { reportId, event: "updated" });
    }

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
async function runPublish(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const reportId = String(formData.get("reportId") ?? "");

  try {
    const session = await requireSessionOrThrow();
    const parsed = parse(formData);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    await persist(session, reportId, parsed, formData);
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

    // Queued, not inline: the fan-out reaches every guardian and sends push, and
    // none of that belongs in the request a teacher is waiting on.
    await enqueue(QUEUES.notifyDailyReport, {
      reportId,
      event: result.wasAlreadyPublished ? "updated" : "ready",
    });

    return { success: result.wasAlreadyPublished ? "resent" : "sentHome" };
  } catch (error) {
    return toState(error, "report-publish");
  }
}

async function runAbsent(
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

    await enqueue(QUEUES.notifyDailyReport, { reportId, event: "absent" });

    return { success: "markedAbsent" };
  } catch (error) {
    return toState(error, "report-absent");
  }
}

/**
 * One action for the whole form, dispatched on an `intent` field.
 *
 * Not three actions with `formAction` on the buttons. That runs the right
 * action — the report really was published — but its return value never reaches
 * the `useActionState` that owns it, so the teacher was told nothing at all
 * while the save behind her succeeded. One form, one hook, one result.
 */
export async function reportAction(
  prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  switch (String(formData.get("intent") ?? "save")) {
    case "publish":
      return runPublish(prev, formData);
    case "absent":
      return runAbsent(prev, formData);
    default:
      return runSave(prev, formData);
  }
}
