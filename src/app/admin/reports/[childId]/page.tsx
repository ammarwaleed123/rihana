import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { NotFoundError } from "@/lib/auth/errors";
import { PageHeader } from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { dateOnly, openDailyReport, outstanding } from "@/lib/data/daily-reports";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/plural";

import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Daily report",
  robots: { index: false, follow: false },
};

/**
 * One child's day.
 *
 * `openDailyReport` creates the report if this is the first teacher to look, so
 * arriving here is the same act as starting one. That is why the list screen
 * links straight to this page rather than offering a "create" button — there is
 * nothing to decide.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { childId } = await params;
  const query = await searchParams;
  const session = await requireStaff(`/admin/reports/${childId}`);
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.reports;

  const requested = query.date ? new Date(`${query.date}T00:00:00Z`) : new Date();
  const day = dateOnly(Number.isNaN(requested.getTime()) ? new Date() : requested);

  /*
   * A child in a class this teacher is not assigned to is a 404, never a 403 —
   * guessing an id must not confirm the child exists at this nursery.
   */
  let report;
  try {
    report = await openDailyReport(session, childId, day);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const missing = outstanding(report);

  const dayFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const editedFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const childName = `${report.child.firstName} ${report.child.lastName}`;
  const dayValue = day.toISOString().slice(0, 10);

  return (
    <div>
      <AdminNav current="/admin/reports" role={session.user.role} t={dict.admin.nav} />

      <p className="mb-4">
        <Link
          href={`/admin/reports?date=${dayValue}${report.classId ? `&classId=${report.classId}` : ""}`}
          className="text-sm font-bold text-ink-soft hover:text-leaf"
        >
          ← {t.backToDay}
        </Link>
      </p>

      <PageHeader title={childName} description={dayFormat.format(day)} />

      {report.status === "ABSENT" ? (
        <div className="mb-6">
          <Alert tone="info">{fill(t.absentNotice, { name: childName })}</Alert>
        </div>
      ) : null}

      {/*
       * A durable confirmation, rendered from the report's own state.
       *
       * The transient "saved" message vanishes the moment revalidation
       * re-renders the page, so a teacher could send a report home and be shown
       * nothing at all. This survives that, and a reload.
       */}
      {report.status === "PUBLISHED" && !report.lastEditedAt && report.publishedAt ? (
        <div className="mb-6">
          <Alert tone="success">
            {fill(t.sentHomeNotice, {
              date: editedFormat.format(report.publishedAt),
              name: report.publishedBy?.name ?? "",
            })}
          </Alert>
        </div>
      ) : null}

      {report.status === "PUBLISHED" && report.lastEditedAt ? (
        <div className="mb-6">
          <Alert tone="info">
            {fill(t.editedNotice, {
              date: editedFormat.format(report.lastEditedAt),
              name: report.lastEditedBy?.name ?? "",
            })}
          </Alert>
        </div>
      ) : null}

      <ReportForm
        report={{
          id: report.id,
          status: report.status,
          arrivalTime: report.arrivalTime ?? "",
          playAreas: report.playAreas,
          alsoEnjoyed: report.alsoEnjoyed ?? "",
          quranMemorised: report.quranMemorised ?? "",
          quranRevision: report.quranRevision ?? "",
          littleMuslim: report.littleMuslim ?? "",
          napNone: report.napNone,
          napFrom: report.napFrom ?? "",
          napUntil: report.napUntil ?? "",
          toiletNothingToRecord: report.toiletNothingToRecord,
          toiletEntries: report.toiletEntries.map((entry) => ({
            time: entry.time,
            wet: entry.wet,
            bm: entry.bm,
            accident: entry.accident,
          })),
          bringCleanClothes: report.bringCleanClothes,
          bringDiapers: report.bringDiapers,
          bringOther: report.bringOther ?? "",
          teacherComments: report.teacherComments ?? "",
          meals: report.meals.map((meal) => ({
            meal: meal.meal,
            amount: meal.amount,
            description: meal.description ?? "",
          })),
        }}
        initialMissing={missing}
        childName={childName}
        t={t}
      />
    </div>
  );
}
