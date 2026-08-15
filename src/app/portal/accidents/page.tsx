import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { listAccidentsForParent } from "@/lib/data/accident-reports";
import { acknowledgementIsStale } from "@/lib/data/accident-rules";
import { getMyChildren } from "@/lib/data/photos";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/plural";

export const metadata: Metadata = {
  title: "Accidents",
  robots: { index: false, follow: false },
};

/**
 * A family's accident records.
 *
 * Usually empty, and that is the point — the page exists so a parent always has
 * somewhere to look, not because there is normally something to see. Days with
 * no incidents never appear: an empty record exists only because a teacher
 * opened the screen, and showing it would announce an accident that never
 * happened.
 */
export default async function PortalAccidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/accidents");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.portal.accidents;

  const [reports, children] = await Promise.all([
    listAccidentsForParent(session, params.childId),
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
          <ChildChip href="/portal/accidents" active={!params.childId}>
            {t.everyone}
          </ChildChip>
          {children.map((child) => (
            <ChildChip
              key={child.id}
              href={`/portal/accidents?childId=${child.id}`}
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
            // Unsigned, or signed before a correction — either way it is
            // waiting on this parent.
            const needsSignature = report.incidents.some((incident) => {
              const mine = incident.acknowledgements[0];
              if (!mine) return true;
              return acknowledgementIsStale(
                mine.acknowledgedAt,
                incident.updatedAt,
              );
            });

            return (
              <li key={report.id}>
                <Link href={`/portal/accidents/${report.id}`} className="block">
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink" dir="auto">
                          {children.length > 1
                            ? `${report.child.firstName} — ${dayFormat.format(report.date)}`
                            : dayFormat.format(report.date)}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-faint">
                          {plural(t.count, report.incidents.length, locale)}
                        </p>
                      </div>

                      {needsSignature ? (
                        <Badge tone="yellow">{t.needsSignature}</Badge>
                      ) : null}
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
