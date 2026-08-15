import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  MAX_INCIDENTS_PER_DAY,
  incidentMissingFields,
  type IncidentMissingField,
} from "@/lib/data/accident-rules";
import { PARENT_VISIBLE_DAYS, dateOnly } from "@/lib/data/daily-reports";
import {
  assertCanViewChild,
  childIdsForParent,
  classIdsForTeacher,
} from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";

/**
 * The accident report.
 *
 * The most sensitive records in the system — an injury, what was done about it,
 * whether a doctor was called — and the only place in the app where a record
 * must point at a person rather than an account, which is what the drawn
 * signature is for.
 *
 * Differences from the daily report, all deliberate:
 *
 *   - There is no draft. An accident is written once, signed, and reaches the
 *     family immediately. A half-written injury sitting unseen in a database is
 *     the failure mode this form exists to prevent.
 *   - One report per child per day holds MANY incidents. A second accident is
 *     added to the day rather than starting a new record, which is how the
 *     nursery already works on paper.
 *   - A guardian's acknowledgement is per incident, not per day. Signing for
 *     the morning does not stand for an afternoon they have not yet seen.
 *
 * Scope resolves through `assertCanViewChild`, the same function photos and
 * daily reports use, so an accident cannot be reachable by anyone a photo would
 * not be. Wrong child is always 404, never 403.
 */

const incidentSelect = {
  id: true,
  reportId: true,
  timeOfIncident: true,
  place: true,
  placeOther: true,
  figure: true,
  bodyParts: true,
  nature: true,
  natureOther: true,
  treatment: true,
  treatmentOther: true,
  description: true,
  parentsNotified: true,
  doctorNotified: true,
  notificationTime: true,
  signedAt: true,
  createdAt: true,
  updatedAt: true,
  signedBy: { select: { id: true, name: true } },
  /*
   * Every guardian's, not the caller's — staff are asking who still has to be
   * chased. The parent-facing query narrows this to `userId` so a family sees
   * only their own signature back.
   */
  acknowledgements: { select: { userId: true, acknowledgedAt: true } },
} as const;

const reportSelect = {
  id: true,
  childId: true,
  date: true,
  classId: true,
  createdAt: true,
  child: { select: { id: true, firstName: true, lastName: true } },
  incidents: {
    select: incidentSelect,
    orderBy: { timeOfIncident: "asc" },
  },
} as const;

export type AccidentReportRecord = Awaited<
  ReturnType<typeof getAccidentReportForStaff>
>;

function assertStaff(session: Session) {
  if (session.user.role === "PARENT") throw new ForbiddenError();
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/**
 * Open a child's accident record for a day, creating the empty day if this is
 * the first teacher to look.
 *
 * The upsert on (childId, date) is what makes two teachers recording two
 * separate accidents land on one record rather than racing to create two — the
 * same guarantee the daily report relies on, for the same reason.
 */
export async function openAccidentReport(
  session: Session,
  childId: string,
  date: Date,
) {
  assertStaff(session);
  const child = await assertCanViewChild(session, childId);

  const day = dateOnly(date);

  await prisma.accidentReport.upsert({
    where: { childId_date: { childId, date: day } },
    update: {},
    create: {
      childId,
      date: day,
      // Snapshot, as on the daily report: moving the child to another class
      // later must not re-scope who may read what happened today.
      classId: child.classId,
    },
    select: { id: true },
  });

  const report = await prisma.accidentReport.findUnique({
    where: { childId_date: { childId, date: day } },
    select: reportSelect,
  });

  if (!report) throw new NotFoundError();
  return report;
}

export async function getAccidentReportForStaff(
  session: Session,
  reportId: string,
) {
  const report = await prisma.accidentReport.findUnique({
    where: { id: reportId },
    select: reportSelect,
  });

  if (!report) throw new NotFoundError();
  // Re-resolve through the child. Scope is never taken from the report row.
  await assertCanViewChild(session, report.childId);
  return report;
}

export type IncidentInput = {
  timeOfIncident: string;
  place: string;
  placeOther: string | null;
  figure: string;
  bodyParts: string[];
  nature: string[];
  natureOther: string | null;
  treatment: string[];
  treatmentOther: string | null;
  description: string;
  parentsNotified: boolean;
  doctorNotified: boolean;
  notificationTime: string | null;
};

/**
 * What is still missing before this can be recorded.
 *
 * Takes the signature separately because it is not a column on the input — it
 * is a file the caller has or has not been given.
 */
export function outstandingForIncident(
  input: Partial<IncidentInput>,
  signed: boolean,
): IncidentMissingField[] {
  return incidentMissingFields({
    timeOfIncident: input.timeOfIncident ?? null,
    place: input.place ?? null,
    placeOther: input.placeOther ?? null,
    figure: input.figure ?? null,
    bodyParts: input.bodyParts ?? [],
    nature: input.nature ?? [],
    natureOther: input.natureOther ?? null,
    treatment: input.treatment ?? [],
    treatmentOther: input.treatmentOther ?? null,
    description: input.description ?? null,
    parentsNotified: input.parentsNotified ?? false,
    doctorNotified: input.doctorNotified ?? false,
    notificationTime: input.notificationTime ?? null,
    signed,
  });
}

/**
 * Record one accident.
 *
 * Complete or nothing: the check runs here as well as in the interface, because
 * a form is a convenience and this is the rule.
 */
export async function createIncident(
  session: Session,
  reportId: string,
  input: IncidentInput,
  signatureStorageKey: string,
) {
  assertStaff(session);
  const report = await getAccidentReportForStaff(session, reportId);

  const missing = outstandingForIncident(input, true);
  if (missing.length > 0) return { created: false as const, missing };

  if (report.incidents.length >= MAX_INCIDENTS_PER_DAY) {
    throw new ForbiddenError(
      "This day already holds the most accidents this form can record.",
    );
  }

  const incident = await prisma.accidentIncident.create({
    data: {
      reportId,
      timeOfIncident: input.timeOfIncident,
      place: input.place as never,
      placeOther: input.placeOther,
      figure: input.figure as never,
      bodyParts: input.bodyParts as never,
      nature: input.nature as never,
      natureOther: input.natureOther,
      treatment: input.treatment as never,
      treatmentOther: input.treatmentOther,
      description: input.description,
      parentsNotified: input.parentsNotified,
      doctorNotified: input.doctorNotified,
      notificationTime: input.notificationTime,
      signatureStorageKey,
      signedByUserId: session.user.id,
    },
    select: { id: true },
  });

  return {
    created: true as const,
    missing: [] as IncidentMissingField[],
    incidentId: incident.id,
    childId: report.childId,
    child: report.child,
    date: report.date,
  };
}

/**
 * Correct an accident already recorded.
 *
 * Re-signing is required rather than optional. The signature attests to what
 * the record says; once the record changes, the old signature attests to
 * something that is no longer on the screen, and `signedBy` would name a person
 * who never saw this version.
 *
 * Returns the superseded signature key so the caller can remove the object it
 * points at — nothing else references it after this.
 */
export async function updateIncident(
  session: Session,
  incidentId: string,
  input: IncidentInput,
  signatureStorageKey: string,
) {
  assertStaff(session);

  const existing = await prisma.accidentIncident.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      signatureStorageKey: true,
      report: { select: { id: true, childId: true, date: true } },
    },
  });

  if (!existing) throw new NotFoundError();
  const child = await assertCanViewChild(session, existing.report.childId);

  const missing = outstandingForIncident(input, true);
  if (missing.length > 0) return { updated: false as const, missing };

  await prisma.accidentIncident.update({
    where: { id: incidentId },
    data: {
      timeOfIncident: input.timeOfIncident,
      place: input.place as never,
      placeOther: input.placeOther,
      figure: input.figure as never,
      bodyParts: input.bodyParts as never,
      nature: input.nature as never,
      natureOther: input.natureOther,
      treatment: input.treatment as never,
      treatmentOther: input.treatmentOther,
      description: input.description,
      parentsNotified: input.parentsNotified,
      doctorNotified: input.doctorNotified,
      notificationTime: input.notificationTime,
      signatureStorageKey,
      signedByUserId: session.user.id,
      signedAt: new Date(),
    },
  });

  /*
   * Acknowledgements are deliberately NOT deleted here.
   *
   * `updatedAt` now sits after the parent's `acknowledgedAt`, which is what the
   * portal reads to ask them again — so the record still shows that they saw
   * the earlier version and when. Deleting the row would erase that, and a
   * parent who signed at 15:02 would look like a parent who never signed.
   */

  return {
    updated: true as const,
    missing: [] as IncidentMissingField[],
    incidentId,
    childId: existing.report.childId,
    child: { firstName: child.firstName, lastName: child.lastName },
    date: existing.report.date,
    previousSignatureKey: existing.signatureStorageKey,
  };
}

/**
 * Remove an accident recorded in error.
 *
 * Owner only. A teacher corrects; destroying the record of an injury is a
 * different act, and it takes the acknowledgement signatures with it. Both
 * signature keys are returned so the caller can purge the objects.
 */
export async function deleteIncident(session: Session, incidentId: string) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const incident = await prisma.accidentIncident.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      signatureStorageKey: true,
      timeOfIncident: true,
      acknowledgements: { select: { signatureStorageKey: true } },
      report: {
        select: {
          id: true,
          childId: true,
          date: true,
          child: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!incident) throw new NotFoundError();
  await assertCanViewChild(session, incident.report.childId);

  const orphanedKeys = [
    incident.signatureStorageKey,
    ...incident.acknowledgements.map((a) => a.signatureStorageKey),
  ].filter((key): key is string => Boolean(key));

  await prisma.accidentIncident.delete({ where: { id: incidentId } });

  return {
    childId: incident.report.childId,
    child: incident.report.child,
    date: incident.report.date,
    timeOfIncident: incident.timeOfIncident,
    orphanedKeys,
  };
}

/**
 * A teacher's day: every child in the class, and how many accidents each has.
 *
 * Children with none are listed too, exactly as on the daily report screen —
 * the list is a way to reach a child, not a list of the injured.
 */
export async function listClassDayAccidents(
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

  const reports = await prisma.accidentReport.findMany({
    where: { classId, date: day },
    select: {
      id: true,
      childId: true,
      _count: { select: { incidents: true } },
    },
  });

  const byChild = new Map(reports.map((r) => [r.childId, r]));

  return children.map((child) => {
    const report = byChild.get(child.id) ?? null;
    return {
      child,
      reportId: report?.id ?? null,
      incidentCount: report?._count.incidents ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

/**
 * Every recent accident across a parent's children, newest first.
 *
 * Scope comes from the caller's own guardianships, never from the request. A
 * `childId` filter narrows within that set and can only shrink it — passing
 * someone else's child yields nothing rather than an error, because the filter
 * is intersected with what they may see rather than trusted.
 *
 * Days with no incidents are excluded: an empty record exists only because a
 * teacher opened the screen, and telling a family "there was an accident" and
 * then showing them nothing would be its own small cruelty.
 */
export async function listAccidentsForParent(
  session: Session,
  childId?: string,
) {
  const mine = await childIdsForParent(session.user.id);
  const ids = childId ? mine.filter((id) => id === childId) : mine;
  if (ids.length === 0) return [];

  const since = dateOnly(new Date());
  since.setUTCDate(since.getUTCDate() - PARENT_VISIBLE_DAYS);

  return prisma.accidentReport.findMany({
    where: {
      childId: { in: ids },
      date: { gte: since },
      incidents: { some: {} },
    },
    select: {
      id: true,
      date: true,
      child: { select: { id: true, firstName: true } },
      incidents: {
        select: {
          id: true,
          timeOfIncident: true,
          updatedAt: true,
          acknowledgements: {
            where: { userId: session.user.id },
            select: { acknowledgedAt: true },
          },
        },
        orderBy: { timeOfIncident: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function getAccidentReportForParent(
  session: Session,
  reportId: string,
) {
  const report = await prisma.accidentReport.findUnique({
    where: { id: reportId },
    select: {
      ...reportSelect,
      incidents: {
        select: {
          ...incidentSelect,
          acknowledgements: {
            where: { userId: session.user.id },
            select: { acknowledgedAt: true },
          },
        },
        orderBy: { timeOfIncident: "asc" },
      },
    },
  });

  if (!report) throw new NotFoundError();
  await assertCanViewChild(session, report.childId);

  // A day a teacher opened and never wrote on does not exist for a family.
  if (report.incidents.length === 0) throw new NotFoundError();

  return report;
}

/**
 * A guardian signs to say they were told.
 *
 * One row per guardian: two parents each sign for themselves, and neither
 * speaks for the other. Re-signing after a correction replaces the signature
 * and the timestamp, so `acknowledgedAt` always answers "when did they agree to
 * what is on the screen now" — which is the only question it is ever asked.
 *
 * Returns the superseded key, if there was one, for the caller to purge.
 */
export async function acknowledgeIncident(
  session: Session,
  incidentId: string,
  signatureStorageKey: string,
) {
  if (session.user.role !== "PARENT") {
    throw new ForbiddenError("Only a guardian can sign an accident report.");
  }

  const incident = await prisma.accidentIncident.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      timeOfIncident: true,
      report: { select: { id: true, childId: true, date: true } },
    },
  });

  if (!incident) throw new NotFoundError();
  await assertCanViewChild(session, incident.report.childId);

  const existing = await prisma.accidentAcknowledgement.findUnique({
    where: { incidentId_userId: { incidentId, userId: session.user.id } },
    select: { signatureStorageKey: true },
  });

  await prisma.accidentAcknowledgement.upsert({
    where: { incidentId_userId: { incidentId, userId: session.user.id } },
    update: { signatureStorageKey, acknowledgedAt: new Date() },
    create: { incidentId, userId: session.user.id, signatureStorageKey },
  });

  return {
    childId: incident.report.childId,
    reportId: incident.report.id,
    date: incident.report.date,
    timeOfIncident: incident.timeOfIncident,
    previousSignatureKey:
      existing && existing.signatureStorageKey !== signatureStorageKey
        ? existing.signatureStorageKey
        : null,
  };
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

/**
 * THE authorization check in front of a signature image.
 *
 * Returns null for "not yours" and "no such signature" alike, so the route
 * above it can answer 404 to both without having to know which it was.
 *
 * A guardian may see the other guardian's signature on their own child's
 * record: on paper both sign the same sheet, and hiding one from the other
 * would mean a mother could not tell whether the father had already been told.
 */
export async function getSignatureKeyForViewer(
  session: Session,
  kind: "incident" | "acknowledgement",
  id: string,
): Promise<string | null> {
  if (kind === "incident") {
    const incident = await prisma.accidentIncident.findUnique({
      where: { id },
      select: {
        signatureStorageKey: true,
        report: { select: { childId: true } },
      },
    });
    if (!incident) return null;

    try {
      await assertCanViewChild(session, incident.report.childId);
    } catch {
      return null;
    }
    return incident.signatureStorageKey;
  }

  const acknowledgement = await prisma.accidentAcknowledgement.findUnique({
    where: { id },
    select: {
      signatureStorageKey: true,
      incident: { select: { report: { select: { childId: true } } } },
    },
  });
  if (!acknowledgement) return null;

  try {
    await assertCanViewChild(
      session,
      acknowledgement.incident.report.childId,
    );
  } catch {
    return null;
  }
  return acknowledgement.signatureStorageKey;
}

/**
 * Every signature object belonging to one child.
 *
 * For the erasure path. Photos taught this lesson once already: a purge that
 * deletes rows and forgets the files leaves the actual images of a child in a
 * bucket after the family was told they were gone.
 */
export async function signatureKeysForChild(
  childId: string,
): Promise<string[]> {
  const incidents = await prisma.accidentIncident.findMany({
    where: { report: { childId } },
    select: {
      signatureStorageKey: true,
      acknowledgements: { select: { signatureStorageKey: true } },
    },
  });

  return incidents
    .flatMap((incident) => [
      incident.signatureStorageKey,
      ...incident.acknowledgements.map((a) => a.signatureStorageKey),
    ])
    .filter((key): key is string => Boolean(key));
}
