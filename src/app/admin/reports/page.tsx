import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { listClassesForSession } from "@/lib/data/classes";
import { dateOnly, listClassDay } from "@/lib/data/daily-reports";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";

import { DayPicker } from "./day-picker";

export const metadata: Metadata = {
  title: "Daily reports",
  robots: { index: false, follow: false },
};

/**
 * A teacher's day: every child in the class, and where their report has got to.
 *
 * Children with no report yet are listed too — that is the whole point of the
 * screen. A teacher should see who still needs doing without remembering.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
  const query = await searchParams;
  const session = await requireStaff("/admin/reports");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.reports;

  const classes = await listClassesForSession(session);

  // Default to the caller's first class rather than making them choose before
  // they can see anything. A teacher usually has exactly one.
  const selectedClassId =
    query.classId && classes.some((c) => c.id === query.classId)
      ? query.classId
      : (classes[0]?.id ?? null);

  const requestedDate = query.date ? new Date(`${query.date}T00:00:00Z`) : new Date();
  const day = dateOnly(
    Number.isNaN(requestedDate.getTime()) ? new Date() : requestedDate,
  );
  const dayValue = day.toISOString().slice(0, 10);

  const rows = selectedClassId
    ? await listClassDay(session, selectedClassId, day)
    : [];

  const dayFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div>
      <AdminNav current="/admin/reports" role={session.user.role} t={dict.admin.nav} />

      <PageHeader title={t.title} description={t.description} />

      {classes.length === 0 ? (
        <EmptyState title={t.noClasses} description={t.description} />
      ) : (
        <>
          <DayPicker
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            selectedClassId={selectedClassId ?? ""}
            date={dayValue}
            t={{
              chooseClass: t.chooseClass,
              chooseDate: t.chooseDate,
              today: t.today,
            }}
          />

          <p className="mb-4 text-sm font-semibold text-ink-soft">
            {dayFormat.format(day)}
          </p>

          {rows.length === 0 ? (
            <EmptyState title={t.noChildren} description={t.description} />
          ) : (
            <ul className="space-y-2">
              {rows.map(({ child, report }) => (
                <li key={child.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink" dir="auto">
                          {child.firstName} {child.lastName}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-faint">
                          {report === null
                            ? t.statusNotStarted
                            : report.status === "DRAFT"
                              ? t.statusDraft
                              : report.status === "ABSENT"
                                ? t.statusAbsent
                                : t.statusPublished}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {report?.status === "PUBLISHED" ? (
                          <Badge tone="green">{t.statusPublished}</Badge>
                        ) : report?.status === "ABSENT" ? (
                          <Badge tone="neutral">{t.statusAbsent}</Badge>
                        ) : report ? (
                          <Badge tone="yellow">{t.statusDraft}</Badge>
                        ) : null}

                        <Link
                          href={`/admin/reports/${child.id}?date=${dayValue}`}
                          className="rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-leaf hover:text-leaf"
                        >
                          {report ? t.open : t.start}
                        </Link>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
