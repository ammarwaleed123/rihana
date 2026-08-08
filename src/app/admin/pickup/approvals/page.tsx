import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { Card, EmptyState, PageHeader } from "@/components/ui/shell";
import { requireOwner } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { getPendingPickupApprovals } from "@/lib/data/pickup";
import {
  approvePickupAction,
  rejectPickupAction,
} from "@/lib/admin/pickup-actions";

export const metadata: Metadata = {
  title: "Pickup approvals",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PickupApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; rejected?: string; gone?: string }>;
}) {
  const session = await requireOwner("/admin/pickup/approvals");
  const dict = await getDictionary(await getAppLocale());
  const t = dict.admin.approvals;
  const query = await searchParams;
  const pending = await getPendingPickupApprovals(session);

  return (
    <div>
      <AdminNav current="/admin/pickup" role={session.user.role} t={dict.admin.nav} />

      <div className="mb-2">
        <Link
          href="/admin/pickup"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          <span aria-hidden className="rtl:-scale-x-100">
            ←
          </span>{" "}
          {dict.admin.pickupBoard.backToBoard}
        </Link>
      </div>

      <PageHeader
        title={t.title}
        description={t.description}
      />

      {query.approved ? (
        <div className="mb-4">
          <Alert tone="success">{t.approvedToast}</Alert>
        </div>
      ) : null}
      {query.rejected ? (
        <div className="mb-4">
          <Alert tone="success">{t.rejectedToast}</Alert>
        </div>
      ) : null}
      {query.gone ? (
        <div className="mb-4">
          <Alert tone="info">
            {t.alreadyHandled}
          </Alert>
        </div>
      ) : null}

      {pending.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyBody}
        />
      ) : (
        <ul className="space-y-4">
          {pending.map((person) => (
            <li key={person.id}>
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <span className="size-16 shrink-0 overflow-hidden rounded-full bg-ink/5">
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
                        className="flex h-full w-full items-center justify-center text-xl font-bold text-ink-faint"
                      >
                        {person.fullName.charAt(0)}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-semibold">
                      {person.fullName}
                    </p>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      <Row label={t.relationship} value={person.relationship} />
                      <Row label={t.phone} value={person.phone} />
                      <Row
                        label={t.child}
                        value={`${person.child.firstName} ${person.child.lastName}${person.child.className ? ` · ${person.child.className}` : ""}`}
                      />
                      <Row label={t.requestedBy} value={person.requestedBy} />
                      <Row
                        label={t.requested}
                        value={dateFormat.format(person.createdAt)}
                      />
                      {person.expiresAt ? (
                        <Row
                          label={t.onlyUntil}
                          value={
                            (person.isExpired ? "Expired — " : "") +
                            dateFormat.format(person.expiresAt)
                          }
                        />
                      ) : null}
                    </dl>

                    {person.isExpired ? (
                      <p className="mt-3 rounded-lg bg-sun-soft px-3 py-2 text-sm font-semibold text-warning">
                        The end date on this request has already passed — check
                        with the parent before approving.
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <form action={approvePickupAction}>
                        <input
                          type="hidden"
                          name="pickupPersonId"
                          value={person.id}
                        />
                        <button
                          type="submit"
                          className="w-full rounded-full bg-leaf px-6 py-2.5 font-bold text-white hover:bg-leaf-dark sm:w-auto"
                        >
                          {t.approve}
                        </button>
                      </form>

                      <form
                        action={rejectPickupAction}
                        className="flex flex-1 items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="pickupPersonId"
                          value={person.id}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`reason-${person.id}`}
                            className="mb-1 block text-xs font-bold text-ink-soft"
                          >
                            {t.reasonOptional}
                          </label>
                          <input
                            id={`reason-${person.id}`}
                            name="reason"
                            maxLength={300}
                            placeholder={t.shownToParent}
                            className="w-full rounded-xl border-2 border-ink/15 bg-card px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          type="submit"
                          className="rounded-full border-2 border-danger/40 bg-card px-5 py-2.5 font-bold text-danger hover:bg-coral-soft"
                        >
                          {t.reject}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-24 shrink-0 font-bold text-ink-soft">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
