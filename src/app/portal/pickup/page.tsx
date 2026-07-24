import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getParentPickupSummary } from "@/lib/data/pickup";

export const metadata: Metadata = {
  title: "Pickup",
  robots: { index: false, follow: false },
};

export default async function PickupOverviewPage() {
  const session = await requireParent("/portal/pickup");
  const children = await getParentPickupSummary(session);

  return (
    <div>
      <PageHeader
        title="Pickup"
        description="Say who may collect each of your children — or that they ride the nursery bus. Everyone you add is checked by the nursery before they can collect."
      />

      {children.length === 0 ? (
        <EmptyState
          title="No children linked yet"
          description="When the nursery links a child to your account, you can set up who may collect them here."
        />
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
                    {child.className ?? "No class"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {child.method === "BUS" ? (
                      <span className="text-leaf-dark">🚌 Rides the nursery bus</span>
                    ) : (
                      <>
                        <span className="text-leaf-dark">
                          {child.approvedCount} approved
                        </span>
                        {child.pendingCount > 0 ? (
                          <span className="text-warning">
                            {" · "}
                            {child.pendingCount} awaiting approval
                          </span>
                        ) : null}
                        {child.approvedCount === 0 && child.pendingCount === 0 ? (
                          <span className="text-ink-faint">
                            {" · "}No one added yet
                          </span>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-ink-faint">
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
