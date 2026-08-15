import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { DayPicker } from "@/components/admin/day-picker";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { listClassDayAccidents } from "@/lib/data/accident-reports";
import { listClassesForSession } from "@/lib/data/classes";
import { dateOnly } from "@/lib/data/daily-reports";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/plural";

export const metadata: Metadata = {
  title: "Accidents",
  robots: { index: false, follow: false },
};

/**
 * A teacher's day, for accidents.
 *
 * Every child in the class is listed, not only the ones who were hurt. The
 * screen is a way to reach a child and write a record — a list of only the
 * injured would be a list nobody could add to.
 */
export default async function AccidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
  const query = await searchParams;
  const session = await requireStaff("/admin/accidents");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.accidents;

  const classes = await listClassesForSession(session);

  const selectedClassId =
    query.classId && classes.some((c) => c.id === query.classId)
      ? query.classId
      : (classes[0]?.id ?? null);

  const requestedDate = query.date
    ? new Date(`${query.date}T00:00:00Z`)
    : new Date();
  const day = dateOnly(
    Number.isNaN(requestedDate.getTime()) ? new Date() : requestedDate,
  );
  const dayValue = day.toISOString().slice(0, 10);

  const rows = selectedClassId
    ? await listClassDayAccidents(session, selectedClassId, day)
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
      <AdminNav
        current="/admin/accidents"
        role={session.user.role}
        t={dict.admin.nav}
      />

      <PageHeader title={t.title} description={t.description} />

      {classes.length === 0 ? (
        <EmptyState title={t.noClasses} description={t.description} />
      ) : (
        <>
          <DayPicker
            basePath="/admin/accidents"
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            selectedClassId={selectedClassId ?? ""}
            date={dayValue}
            t={{
              chooseClass: dict.admin.reports.chooseClass,
              chooseDate: dict.admin.reports.chooseDate,
              today: dict.admin.reports.today,
            }}
          />

          <p className="mb-4 text-sm font-semibold text-ink-soft">
            {dayFormat.format(day)}
          </p>

          {rows.length === 0 ? (
            <EmptyState title={t.noChildren} description={t.description} />
          ) : (
            <ul className="space-y-2">
              {rows.map(({ child, incidentCount }) => (
                <li key={child.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink" dir="auto">
                          {child.firstName} {child.lastName}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-faint">
                          {incidentCount === 0
                            ? t.none
                            : plural(t.count, incidentCount, locale)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {incidentCount > 0 ? (
                          <Badge tone="yellow">
                            {plural(t.count, incidentCount, locale)}
                          </Badge>
                        ) : null}

                        <Link
                          href={`/admin/accidents/${child.id}?date=${dayValue}`}
                          className="rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-leaf hover:text-leaf"
                        >
                          {incidentCount > 0 ? t.open : t.record}
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
