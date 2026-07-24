import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PickupStatusBadge } from "@/components/pickup/status-badge";
import { Alert } from "@/components/ui/form";
import { Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { NotFoundError } from "@/lib/auth/errors";
import { getChildPickupDetail, type PickupPersonItem } from "@/lib/data/pickup";
import { revokePickupPersonAction } from "@/lib/portal/pickup-actions";

import { AddPickupPersonForm, PickupMethodForm } from "../pickup-forms";

export const metadata: Metadata = {
  title: "Pickup",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function ChildPickupPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ added?: string; updated?: string }>;
}) {
  const { childId } = await params;
  const query = await searchParams;
  const session = await requireParent(`/portal/pickup/${childId}`);

  let detail;
  try {
    detail = await getChildPickupDetail(session, childId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { child, people } = detail;
  const isBus = child.method === "BUS";

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/portal/pickup"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← All children
        </Link>
      </div>

      <PageHeader
        title={`${child.firstName} ${child.lastName}`}
        description={child.className ? `${child.className} · pickup` : "Pickup"}
      />

      {query.added ? (
        <div className="mb-4">
          <Alert tone="success">
            Sent to the nursery for approval. You&rsquo;ll be notified when
            it&rsquo;s reviewed.
          </Alert>
        </div>
      ) : null}
      {query.updated ? (
        <div className="mb-4">
          <Alert tone="success">
            Saved and sent back to the nursery for approval.
          </Alert>
        </div>
      ) : null}

      <div className="space-y-6">
        <Card>
          <SectionTitle>Going home</SectionTitle>
          <PickupMethodForm childId={child.id} method={child.method} />
        </Card>

        {isBus ? (
          <Card>
            <SectionTitle>Nursery bus</SectionTitle>
            <p className="text-ink-soft">
              {child.firstName} goes home on the nursery bus, so no door pickup
              people are needed. Switch to &ldquo;collected at the door&rdquo;
              above if that changes.
            </p>
            {people.length > 0 ? (
              <p className="mt-3 text-sm text-ink-faint">
                You have {people.length} saved pickup{" "}
                {people.length === 1 ? "person" : "people"}. They&rsquo;ll apply
                again if you switch back to door collection.
              </p>
            ) : null}
          </Card>
        ) : (
          <>
            <Card>
              <div className="mb-4 flex items-center justify-between gap-4">
                <SectionTitle>Who can collect {child.firstName}</SectionTitle>
              </div>

              {people.length === 0 ? (
                <p className="text-ink-soft">
                  No one has been added yet. Add the people allowed to collect{" "}
                  {child.firstName} below.
                </p>
              ) : (
                <ul className="space-y-3">
                  {people.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      childId={child.id}
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionTitle>Add someone</SectionTitle>
              <AddPickupPersonForm childId={child.id} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  childId,
}: {
  person: PickupPersonItem;
  childId: string;
}) {
  return (
    <li className="rounded-xl border border-ink/10 bg-paper p-4">
      <div className="flex items-start gap-3">
        <span className="size-12 shrink-0 overflow-hidden rounded-full bg-ink/5">
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
              className="flex h-full w-full items-center justify-center text-lg font-bold text-ink-faint"
            >
              {person.fullName.charAt(0)}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold">{person.fullName}</p>
            <PickupStatusBadge status={person.status} isExpired={person.isExpired} />
          </div>
          <p className="text-sm text-ink-soft">{person.relationship}</p>
          <p className="text-sm text-ink-soft">{person.phone}</p>
          {person.expiresAt ? (
            <p className="mt-0.5 text-sm text-ink-faint">
              {person.isExpired ? "Was allowed until " : "Allowed until "}
              {dateFormat.format(person.expiresAt)}
            </p>
          ) : null}
          {person.status === "REJECTED" && person.rejectionReason ? (
            <p className="mt-1 text-sm font-semibold text-danger">
              Reason: {person.rejectionReason}
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-4">
            <Link
              href={`/portal/pickup/${childId}/${person.id}/edit`}
              className="text-sm font-semibold text-leaf underline underline-offset-4"
            >
              Edit
            </Link>
            <form action={revokePickupPersonAction}>
              <input type="hidden" name="pickupPersonId" value={person.id} />
              <input type="hidden" name="childId" value={childId} />
              <button
                type="submit"
                className="text-sm font-semibold text-danger underline underline-offset-4"
              >
                Remove
              </button>
            </form>
          </div>
        </div>
      </div>
    </li>
  );
}
