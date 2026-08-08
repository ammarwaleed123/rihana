import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { listClassesForSession } from "@/lib/data/classes";
import { countPendingPickupApprovals, getDoorBoard } from "@/lib/data/pickup";

export const metadata: Metadata = {
  title: "Pickup board",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default async function PickupBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const session = await requireStaff("/admin/pickup");
  const dict = await getDictionary(await getAppLocale());
  const t = dict.admin.pickupBoard;
  const { classId } = await searchParams;
  const isOwner = session.user.role === "OWNER";

  const [board, classes, pending] = await Promise.all([
    getDoorBoard(session, { classId: classId ?? null }),
    listClassesForSession(session),
    countPendingPickupApprovals(session),
  ]);

  // Group by class for the day-of view; the query already orders by class name.
  const groups = groupByClass(board);

  return (
    <div>
      <AdminNav current="/admin/pickup" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={t.title}
        description={t.description}
        action={
          isOwner ? (
            <Link
              href="/admin/pickup/approvals"
              className="inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-2.5 font-bold text-white transition-colors hover:bg-leaf-dark"
            >
              {t.approvalsButton}
              {pending > 0 ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white/25 px-2 py-0.5 text-sm">
                  {pending}
                </span>
              ) : null}
            </Link>
          ) : undefined
        }
      />

      {classes.length > 1 ? (
        <form method="get" className="mb-6">
          <label htmlFor="class-filter" className="mr-2 text-sm font-bold">
            {t.classLabel}
          </label>
          <select
            id="class-filter"
            name="classId"
            defaultValue={classId ?? ""}
            className="rounded-xl border-2 border-ink/15 bg-card px-3 py-2 text-sm"
          >
            <option value="">{t.allClasses}</option>
            {classes.map((klass) => (
              <option key={klass.id} value={klass.id}>
                {klass.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="ml-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-bold hover:border-leaf"
          >
            {t.show}
          </button>
        </form>
      ) : null}

      {board.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyBody}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.className ?? "none"}>
              <h2 className="mb-3 font-display text-xl font-semibold">
                {group.className ?? t.noClass}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {group.children.map((child) => (
                  <li key={child.id}>
                    <Card>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-lg font-semibold">
                          {child.firstName} {child.lastName}
                        </p>
                        {child.method === "BUS" ? (
                          <Badge tone="sky">🚌 {t.busBadge}</Badge>
                        ) : (
                          <Badge tone="green">{t.doorCollection}</Badge>
                        )}
                      </div>

                      {child.method === "BUS" ? (
                        <p className="mt-3 text-sm text-ink-soft">
                          {t.busNote}
                        </p>
                      ) : child.people.length === 0 ? (
                        <p className="mt-3 rounded-lg bg-coral-soft px-3 py-2 text-sm font-semibold text-danger">
                          {t.noApprovedPerson}
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {child.people.map((person) => (
                            <li
                              key={person.id}
                              className="flex items-center gap-3"
                            >
                              <span className="size-11 shrink-0 overflow-hidden rounded-full bg-ink/5">
                                {person.hasPhoto ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`/api/img/pickup/${person.id}?v=thumb`}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span
                                    aria-hidden
                                    className="flex h-full w-full items-center justify-center font-bold text-ink-faint"
                                  >
                                    {person.fullName.charAt(0)}
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold">
                                  {person.fullName}
                                </span>
                                <span className="block text-sm text-ink-soft">
                                  {person.relationship} · {person.phone}
                                </span>
                                {person.expiresAt ? (
                                  <span className="block text-xs text-ink-faint">
                                    Until {dateFormat.format(person.expiresAt)}
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByClass(
  board: Awaited<ReturnType<typeof getDoorBoard>>,
): Array<{ className: string | null; children: typeof board }> {
  const groups: Array<{ className: string | null; children: typeof board }> = [];
  for (const child of board) {
    const last = groups[groups.length - 1];
    if (last && last.className === child.className) {
      last.children.push(child);
    } else {
      groups.push({ className: child.className, children: [child] });
    }
  }
  return groups;
}
