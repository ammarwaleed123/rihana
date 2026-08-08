import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getParentPickupSummary } from "@/lib/data/pickup";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { plural } from "@/lib/i18n/plural";

export const metadata: Metadata = {
  title: "Pickup",
  robots: { index: false, follow: false },
};

export default async function PickupOverviewPage() {
  const session = await requireParent("/portal/pickup");
  const children = await getParentPickupSummary(session);

  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.portal.pickup;

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
      />

      {children.length === 0 ? (
        <EmptyState title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <ul className="space-y-3">
          {children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/portal/pickup/${child.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-card p-4 shadow-pin transition-colors hover:border-leaf"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold">
                    {child.firstName} {child.lastName}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {child.className ?? t.noClass}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {child.method === "BUS" ? (
                      <span className="text-leaf-dark">🚌 {t.ridesBus}</span>
                    ) : (
                      <>
                        <span className="text-leaf-dark">
                          {plural(t.approvedCount, child.approvedCount, locale)}
                        </span>
                        {child.pendingCount > 0 ? (
                          <span className="text-warning">
                            {" · "}
                            {plural(t.pendingCount, child.pendingCount, locale)}
                          </span>
                        ) : null}
                        {child.approvedCount === 0 && child.pendingCount === 0 ? (
                          <span className="text-ink-faint">
                            {" · "}
                            {t.noneYet}
                          </span>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 text-ink-faint rtl:-scale-x-100"
                >
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
