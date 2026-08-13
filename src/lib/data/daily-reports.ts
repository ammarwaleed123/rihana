import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { assertCanViewChild, classIdsForTeacher } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import {
  MAX_TOILET_ENTRIES,
  isValidTime,
  missingFields,
  type MissingField,
} from "@/lib/data/report-rules";

/**
 * The daily report — the notebook that goes home with each child.
 *
 * Who may do what:
 *
 *   Teacher   writes for children in a class they are assigned to
 *   Owner     writes for any child
 *   Parent    reads their own child's finished reports, and acknowledges them
 *
 * There is no fourth path. Scope resolves through `assertCanViewChild`, the same
 * function photos use, so a report cannot be reachable by anyone a photo would
 * not be. Wrong child is always 404, never 403 — a 403 would confirm the child
 * is enrolled here.
 */

/**
 * How far back a family may look.
 *
 * A month, as the nursery asked. Older reports are not deleted by this — they
 * simply stop being offered, which keeps the retention decision (still with the
 * owner) independent of what the portal shows.
 */
export const PARENT_VISIBLE_DAYS = 31;

const reportSelect = {
  id: true,
  childId: true,
  date: true,
  status: true,
  classId: true,
  arrivalTime: true,
  playAreas: true,
  alsoEnjoyed: true,
  quranMemorised: true,
  quranRevision: true,
  littleMuslim: true,
  napNone: true,
  napFrom: true,
  napUntil: true,
  toiletNothingToRecord: true,
  bringCleanClothes: true,
  bringDiapers: true,
  bringOther: true,
  teacherComments: true,
  publishedAt: true,
  lastEditedAt: true,
  child: { select: { id: true, firstName: true, lastName: true } },
  publishedBy: { select: { id: true, name: true } },
  lastEditedBy: { select: { id: true, name: true } },
  meals: {
    select: { meal: true, amount: true, description: true },
  },
  toiletEntries: {
    select: { id: true, time: true, wet: true, bm: true, accident: true, position: true },
    orderBy: { position: "asc" },
  },
} as const;

export type DailyReportRecord = Awaited<ReturnType<typeof getReportForStaff>>;

/** Staff only. Parents never write, whatever their relationship to the child. */
function assertStaff(session: Session) {
  if (session.user.role === "PARENT") throw new ForbiddenError();
}

/** Midnight UTC for a calendar day — the shape a `@db.Date` column stores. */
export function dateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/**
 * Open a child's report for a day, creating it if this is the first teacher to
 * look.
 *
 * The upsert is the whole point. Two teachers opening the same child's day at
 * the same moment must land on one row, and the unique constraint on
 * (childId, date) is what guarantees it — not a check-then-insert, which is a
 * race the database would happily lose.
 */
export async function openDailyReport(
  session: Session,
  childId: string,
  date: Date,
) {
  assertStaff(session);
  const child = await assertCanViewChild(session, childId);

  const day = dateOnly(date);

  await prisma.dailyReport.upsert({
    where: { childId_date: { childId, date: day } },
    update: {},
    create: {
      childId,
      date: day,
      // Snapshot: moving the child to another class later must not re-scope
      // who may read what was written today.
      classId: child.classId,
    },
    select: { id: true },
  });

  return getReportForChildAndDate(session, childId, day);
}

export async function getReportForChildAndDate(
  session: Session,
  childId: string,
  date: Date,
) {
  await assertCanViewChild(session, childId);

  const report = await prisma.dailyReport.findUnique({
    where: { childId_date: { childId, date: dateOnly(date) } },
    select: reportSelect,
  });

  if (!report) throw new NotFoundError();
  return report;
}

export async function getReportForStaff(session: Session, reportId: string) {
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: reportSelect,
  });

  if (!report) throw new NotFoundError();
  // Re-resolve through the child, so scope is never taken from the report row.
  await assertCanViewChild(session, report.childId);
  return report;
}

/** What is still missing before this report can go home. */
export function outstanding(report: {
  arrivalTime: string | null;
  playAreas: readonly string[];
  quranMemorised: string | null;
  quranRevision: string | null;
  littleMuslim: string | null;
  napNone: boolean;
  napFrom: string | null;
  napUntil: string | null;
  toiletNothingToRecord: boolean;
  teacherComments: string | null;
  meals: ReadonlyArray<{
    meal: "BREAKFAST" | "SNACK" | "LUNCH";
    amount: "ALL" | "SOME" | "NOT_HUNGRY" | null;
    description: string | null;
  }>;
  toiletEntries: readonly unknown[];
}): MissingField[] {
  return missingFields({
    arrivalTime: report.arrivalTime,
    playAreas: report.playAreas,
    quranMemorised: report.quranMemorised,
    quranRevision: report.quranRevision,
    littleMuslim: report.littleMuslim,
    meals: report.meals,
    napNone: report.napNone,
    napFrom: report.napFrom,
    napUntil: report.napUntil,
    toiletNothingToRecord: report.toiletNothingToRecord,
    toiletEntryCount: report.toiletEntries.length,
    teacherComments: report.teacherComments,
  });
}

export type DailyReportInput = {
  arrivalTime?: string | null;
  playAreas?: string[];
  alsoEnjoyed?: string | null;
  quranMemorised?: string | null;
  quranRevision?: string | null;
  littleMuslim?: string | null;
  napNone?: boolean;
  napFrom?: string | null;
  napUntil?: string | null;
  toiletNothingToRecord?: boolean;
  bringCleanClothes?: boolean;
  bringDiapers?: boolean;
  bringOther?: string | null;
  teacherComments?: string | null;
  meals?: Array<{
    meal: "BREAKFAST" | "SNACK" | "LUNCH";
    amount: "ALL" | "SOME" | "NOT_HUNGRY";
    description?: string | null;
  }>;
  toiletEntries?: Array<{
    time: string;
    wet: boolean;
    bm: boolean;
    accident: boolean;
  }>;
};

/**
 * Save the report.
 *
 * Editing a PUBLISHED report is allowed — the nursery corrects mistakes — but it
 * is a different event from drafting, so `lastEditedAt` is stamped and the
 * caller notifies the family. An ABSENT day is closed and cannot be edited into
 * a normal report; reopening it would mean telling a parent their child was
 * absent and then silently changing the story.
 */
export async function saveDailyReport(
  session: Session,
  reportId: string,
  input: DailyReportInput,
): Promise<{ wasPublished: boolean }> {
  assertStaff(session);
  const existing = await getReportForStaff(session, reportId);

  if (existing.status === "ABSENT") {
    throw new ForbiddenError(
      "This day is closed because the child was marked absent.",
    );
  }

  for (const field of ["arrivalTime", "napFrom", "napUntil"] as const) {
    const value = input[field];
    if (value != null && value !== "" && !isValidTime(value)) {
      throw new ForbiddenError("Times must look like 08:15.");
    }
  }

  const entries = (input.toiletEntries ?? []).slice(0, MAX_TOILET_ENTRIES);
  for (const entry of entries) {
    if (!isValidTime(entry.time)) {
      throw new ForbiddenError("Times must look like 08:15.");
    }
  }

  const wasPublished = existing.status === "PUBLISHED";

  await prisma.$transaction(async (tx) => {
    await tx.dailyReport.update({
      where: { id: reportId },
      data: {
        arrivalTime: input.arrivalTime ?? undefined,
        playAreas: input.playAreas as never,
        alsoEnjoyed: input.alsoEnjoyed ?? undefined,
        quranMemorised: input.quranMemorised ?? undefined,
        quranRevision: input.quranRevision ?? undefined,
        littleMuslim: input.littleMuslim ?? undefined,
        napNone: input.napNone ?? undefined,
        // Clearing the times when "did not sleep" is ticked keeps the two from
        // contradicting each other in the stored row.
        napFrom: input.napNone ? null : (input.napFrom ?? undefined),
        napUntil: input.napNone ? null : (input.napUntil ?? undefined),
        toiletNothingToRecord: input.toiletNothingToRecord ?? undefined,
        bringCleanClothes: input.bringCleanClothes ?? undefined,
        bringDiapers: input.bringDiapers ?? undefined,
        bringOther: input.bringOther ?? undefined,
        teacherComments: input.teacherComments ?? undefined,
        ...(wasPublished
          ? { lastEditedAt: new Date(), lastEditedByUserId: session.user.id }
          : {}),
      },
    });

    if (input.meals) {
      for (const row of input.meals) {
        await tx.dailyReportMeal.upsert({
          where: { reportId_meal: { reportId, meal: row.meal } },
          update: { amount: row.amount, description: row.description ?? null },
          create: {
            reportId,
            meal: row.meal,
            amount: row.amount,
            description: row.description ?? null,
          },
        });
      }
    }

    if (input.toiletEntries) {
      // Replaced wholesale: the table is five short lines, and reconciling them
      // row by row would be more code and more ways to be wrong.
      await tx.dailyReportToiletEntry.deleteMany({ where: { reportId } });
      if (!input.toiletNothingToRecord && entries.length > 0) {
        await tx.dailyReportToiletEntry.createMany({
          data: entries.map((entry, index) => ({
            reportId,
            time: entry.time,
            wet: entry.wet,
            bm: entry.bm,
            accident: entry.accident,
            position: index,
          })),
        });
      }
    }
  });

  return { wasPublished };
}

/**
 * Send the report home.
 *
 * Refuses unless every required field is filled, and returns what is missing so
 * the caller can say which — "some fields are missing" is not an instruction.
 */
export async function publishDailyReport(session: Session, reportId: string) {
  assertStaff(session);
  const report = await getReportForStaff(session, reportId);

  if (report.status === "ABSENT") {
    throw new ForbiddenError("This child was marked absent today.");
  }

  const missing = outstanding(report);
  if (missing.length > 0) return { published: false as const, missing };

  const alreadyPublished = report.status === "PUBLISHED";

  const updated = await prisma.dailyReport.update({
    where: { id: reportId },
    data: alreadyPublished
      ? { lastEditedAt: new Date(), lastEditedByUserId: session.user.id }
      : {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedByUserId: session.user.id,
        },
    select: { id: true, childId: true, date: true },
  });

  return {
    published: true as const,
    missing: [] as MissingField[],
    wasAlreadyPublished: alreadyPublished,
    report: updated,
  };
}

/** The child did not come in. Closes the day and tells the family. */
export async function markChildAbsent(session: Session, reportId: string) {
  assertStaff(session);
  const report = await getReportForStaff(session, reportId);

  if (report.status === "PUBLISHED") {
    throw new ForbiddenError(
      "This report has already been sent home, so the day cannot be marked absent.",
    );
  }

  return prisma.dailyReport.update({
    where: { id: reportId },
    data: {
      status: "ABSENT",
      publishedAt: new Date(),
      publishedByUserId: session.user.id,
    },
    select: { id: true, childId: true, date: true },
  });
}

/**
 * A teacher's list for one day: every child in the class, with the state of
 * their report. Children without a report yet appear too — that is the point of
 * the screen.
 */
export async function listClassDay(
  session: Session,
  classId: string,
  date: Date,
) {
  assertStaff(session);

  if (session.user.role === "TEACHER") {
    const classIds = await classIdsForTeacher(session.user.id);
    if (!classIds.includes(classId)) throw new NotFoundError();
  }

  const day = dateOnly(date);

  const children = await prisma.child.findMany({
    where: { classId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const reports = await prisma.dailyReport.findMany({
    where: { classId, date: day },
    select: { id: true, childId: true, status: true, publishedAt: true },
  });

  const byChild = new Map(reports.map((r) => [r.childId, r]));

  return children.map((child) => ({
    child,
    report: byChild.get(child.id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

/**
 * A parent's reports for one child.
 *
 * Drafts are excluded, not filtered in the interface: an unfinished report must
 * be unreachable, not merely unlisted.
 */
export async function listReportsForParent(session: Session, childId: string) {
  await assertCanViewChild(session, childId);

  const since = dateOnly(new Date());
  since.setUTCDate(since.getUTCDate() - PARENT_VISIBLE_DAYS);

  return prisma.dailyReport.findMany({
    where: {
      childId,
      status: { in: ["PUBLISHED", "ABSENT"] },
      date: { gte: since },
    },
    select: {
      id: true,
      date: true,
      status: true,
      publishedAt: true,
      lastEditedAt: true,
      acknowledgements: {
        where: { userId: session.user.id },
        select: { acknowledgedAt: true },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function getReportForParent(session: Session, reportId: string) {
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: {
      ...reportSelect,
      acknowledgements: {
        where: { userId: session.user.id },
        select: { acknowledgedAt: true },
      },
    },
  });

  if (!report) throw new NotFoundError();
  await assertCanViewChild(session, report.childId);

  // An unfinished report does not exist as far as a family is concerned.
  if (report.status === "DRAFT") throw new NotFoundError();

  return report;
}

/**
 * A guardian confirms they have read it.
 *
 * One row per guardian: two parents each acknowledge for themselves, and
 * neither speaks for the other. Idempotent, so a double tap is harmless.
 */
export async function acknowledgeDailyReport(
  session: Session,
  reportId: string,
) {
  if (session.user.role !== "PARENT") {
    throw new ForbiddenError("Only a guardian can acknowledge a report.");
  }

  const report = await getReportForParent(session, reportId);

  await prisma.dailyReportAcknowledgement.upsert({
    where: { reportId_userId: { reportId, userId: session.user.id } },
    update: {},
    create: { reportId, userId: session.user.id },
  });

  return { childId: report.childId, date: report.date };
}
