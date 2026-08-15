import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
import { openAccidentReport } from "@/lib/data/accident-reports";
import { acknowledgementIsStale } from "@/lib/data/accident-rules";
import { dateOnly } from "@/lib/data/daily-reports";
import { getDictionary } from "@/lib/i18n";
import {
  natureLabel,
  partLabel,
  placeLabel,
  treatmentLabel,
} from "@/lib/i18n/accident-labels";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { fill, joinList } from "@/lib/i18n/plural";
import type {
  ACCIDENT_PLACES,
  BODY_PARTS,
  INJURY_NATURES,
  INJURY_TREATMENTS,
} from "@/lib/validation";

import { IncidentCard, type IncidentView } from "./incident-card";
import { NewIncident } from "./new-incident";

export const metadata: Metadata = {
  title: "Accident report",
  robots: { index: false, follow: false },
};

/**
 * One child's accidents on one day.
 *
 * Opening this page creates the empty day, exactly as the daily report screen
 * does — but an empty day is invisible to the family, so a teacher who taps in
 * to check does not send anyone a record of an accident that never happened.
 */
export default async function AccidentChildPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { childId } = await params;
  const query = await searchParams;
  const session = await requireStaff(`/admin/accidents/${childId}`);
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.accidents;

  const requestedDate = query.date
    ? new Date(`${query.date}T00:00:00Z`)
    : new Date();
  const day = dateOnly(
    Number.isNaN(requestedDate.getTime()) ? new Date() : requestedDate,
  );
  const dayValue = day.toISOString().slice(0, 10);

  /*
   * A child outside this teacher's classes is a 404, not a 403 — a 403 would
   * confirm the child is enrolled here, which is the disclosure the whole
   * scoping model exists to prevent.
   */
  let report;
  try {
    report = await openAccidentReport(session, childId, day);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const dayFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const stampFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const views: IncidentView[] = report.incidents.map((incident) => {
    // Every guardian's signature on this incident, so staff can see who still
    // has to be chased — and whether a correction has overtaken any of them.
    const signed = incident.acknowledgements;
    const stale = signed.some((a) =>
      acknowledgementIsStale(a.acknowledgedAt, incident.updatedAt),
    );
    const latest = signed
      .map((a) => a.acknowledgedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: incident.id,
      timeOfIncident: incident.timeOfIncident,
      place: incident.place,
      placeOther: incident.placeOther,
      figure: incident.figure,
      bodyParts: incident.bodyParts,
      nature: incident.nature,
      natureOther: incident.natureOther,
      treatment: incident.treatment,
      treatmentOther: incident.treatmentOther,
      description: incident.description,
      parentsNotified: incident.parentsNotified,
      doctorNotified: incident.doctorNotified,
      notificationTime: incident.notificationTime,

      signedByName: incident.signedBy?.name ?? "—",
      signedAtLabel: stampFormat.format(incident.signedAt),
      // Only worth saying once it differs from when it was first written.
      correctedLabel:
        incident.updatedAt.getTime() - incident.createdAt.getTime() > 1000
          ? fill(t.correctedNotice, {
              date: stampFormat.format(incident.updatedAt),
            })
          : null,

      family: signed.length === 0 ? "waiting" : stale ? "again" : "signed",
      familySignedLabel: latest
        ? fill(t.signedByFamily, { date: stampFormat.format(latest) })
        : null,

      placeLabel: placeLabel(t, incident.place as (typeof ACCIDENT_PLACES)[number]),
      // Joined here, where the locale is known: "Knee, Hand and Foot" in
      // English, "الركبة واليد والقدم" in Arabic. A hardcoded separator gets one
      // of the two wrong whichever character you pick.
      bodyPartsText: joinList(
        incident.bodyParts.map((part) =>
          partLabel(t, part as (typeof BODY_PARTS)[number]),
        ),
        locale,
      ),
      natureText: joinList(
        [
          ...incident.nature.map((value) =>
            natureLabel(t, value as (typeof INJURY_NATURES)[number]),
          ),
          ...(incident.natureOther ? [incident.natureOther] : []),
        ],
        locale,
      ),
      treatmentText: joinList(
        [
          ...incident.treatment.map((value) =>
            treatmentLabel(t, value as (typeof INJURY_TREATMENTS)[number]),
          ),
          ...(incident.treatmentOther ? [incident.treatmentOther] : []),
        ],
        locale,
      ),
      notifiedText: joinList(
        [
          ...(incident.parentsNotified ? [t.parentsNotified] : []),
          ...(incident.doctorNotified ? [t.doctorNotified] : []),
        ],
        locale,
      ),
    };
  });

  const childName = `${report.child.firstName} ${report.child.lastName}`;

  return (
    <div>
      <AdminNav
        current="/admin/accidents"
        role={session.user.role}
        t={dict.admin.nav}
      />

      <p className="mb-2">
        <Link
          href={`/admin/accidents?date=${dayValue}`}
          className="text-sm font-bold text-ink-soft hover:text-leaf"
        >
          ← {t.backToDay}
        </Link>
      </p>

      <PageHeader
        title={fill(t.dayTitle, { name: childName })}
        description={dayFormat.format(day)}
      />

      <div className="space-y-4 pb-8">
        {views.map((incident) => (
          <IncidentCard
            key={incident.id}
            t={t}
            incident={incident}
            canDelete={session.user.role === "OWNER"}
          />
        ))}

        <NewIncident
          t={t}
          reportId={report.id}
          startOpen={views.length === 0}
        />
      </div>
    </div>
  );
}
