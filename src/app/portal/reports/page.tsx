import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { listRecentReportsForParent } from "@/lib/data/daily-reports";
import { getMyChildren } from "@/lib/data/photos";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "Your child's day",
  robots: { index: false, follow: false },
};

export default async function PortalReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/reports");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.portal.reports;

  const [reports, children] = await Promise.all([
    listRecentReportsForParent(session, params.childId),
    getMyChildren(session),
  ]);

  const dayFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      {children.length > 1 ? (
        <nav aria-label={t.filterByChild} className="mb-6 flex flex-wrap gap-2">
          <ChildChip href="/portal/reports" active={!params.childId}>
            {t.everyone}
          </ChildChip>
          {children.map((child) => (
            <ChildChip
              key={child.id}
              href={`/portal/reports?childId=${child.id}`}
              active={params.childId === child.id}
            >
              {child.firstName}
            </ChildChip>
          ))}
        </nav>
      ) : null}

      {reports.length === 0 ? (
        <EmptyState title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <ul className="space-y-2">
          {reports.map((report) => {
            const seen = report.acknowledgements.length > 0;
            return (
              <li key={report.id}>
                <Link href={`/portal/reports/${report.id}`} className="block">
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink" dir="auto">
                          {children.length > 1
                            ? `${report.child.firstName} — ${dayFormat.format(report.date)}`
                            : dayFormat.format(report.date)}
                        </p>
                        {report.status === "ABSENT" ? (
                          <p className="mt-0.5 text-sm text-ink-faint">{t.absent}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {report.status === "ABSENT" ? (
                          <Badge tone="neutral">{t.absent}</Badge>
                        ) : null}
                        {report.lastEditedAt ? (
                          <Badge tone="yellow">{t.updated}</Badge>
                        ) : null}
                        {/*
                         * An unread report is the one thing a parent is scanning
                         * for, so the badge marks what still needs them rather
                         * than what is already done.
                         */}
                        {seen ? null : <Badge tone="sky">•</Badge>}
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChildChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-full bg-leaf px-4 py-2 text-sm font-bold text-white"
          : "rounded-full border-2 border-ink/15 px-4 py-2 text-sm font-bold text-ink-soft hover:border-leaf hover:text-leaf"
      }
    >
      {children}
    </Link>
  );
}
