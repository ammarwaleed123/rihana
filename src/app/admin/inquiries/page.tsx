import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import {
  Badge,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/shell";
import { requireOwner } from "@/lib/auth/scope";
import {
  listInquiries,
  type InquiryStatusValue,
} from "@/lib/data/inquiries";
import { INQUIRY_STATUSES, inquiryStatusLabels } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Inquiries",
  robots: { index: false, follow: false },
};

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const statusTone: Record<InquiryStatusValue, Parameters<typeof Badge>[0]["tone"]> = {
  NEW: "coral",
  CONTACTED: "sky",
  TOURED: "yellow",
  ENROLLED: "green",
  CLOSED: "neutral",
};

function StatusBadge({ status }: { status: InquiryStatusValue }) {
  return <Badge tone={statusTone[status]}>{inquiryStatusLabels[status]}</Badge>;
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const session = await requireOwner("/admin/inquiries");
  const params = await searchParams;
  const activeStatus = params.status ?? null;

  const page = await listInquiries(session, {
    status: activeStatus,
    cursor: params.cursor ?? null,
  });

  return (
    <div>
      <AdminNav current="/admin/inquiries" role={session.user.role} />

      <PageHeader
        title="Inquiries"
        description="Families who enquired through the website. Work each one along the pipeline as you follow up."
      />

      {/* Status filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip label="All" href="/admin/inquiries" active={!activeStatus} />
        {INQUIRY_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={inquiryStatusLabels[s]}
            href={`/admin/inquiries?status=${s}`}
            active={activeStatus === s}
          />
        ))}
      </div>

      {page.items.length === 0 ? (
        <EmptyState
          title="No inquiries here"
          description="When a family sends an enquiry from the website, it appears here for you to follow up."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Family</Th>
                <Th>Child</Th>
                <Th>Contact</Th>
                <Th>Status</Th>
                <Th>Received</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((i) => (
                <tr key={i.id}>
                  <Td className="font-semibold">{i.parentName}</Td>
                  <Td>{i.childFirstName ?? "—"}</Td>
                  <Td className="text-sm text-ink-soft">
                    {i.email}
                    {i.phone ? <br /> : null}
                    {i.phone}
                  </Td>
                  <Td>
                    <StatusBadge status={i.status} />
                  </Td>
                  <Td className="text-sm text-ink-soft">{when.format(i.createdAt)}</Td>
                  <Td>
                    <Link
                      href={`/admin/inquiries/${i.id}`}
                      className="font-semibold text-leaf underline underline-offset-4"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <CardList>
            {page.items.map((i) => (
              <CardListItem
                key={i.id}
                title={i.parentName}
                badges={<StatusBadge status={i.status} />}
                fields={[
                  { label: "Child", value: i.childFirstName ?? "—" },
                  { label: "Email", value: i.email },
                  { label: "Phone", value: i.phone ?? "—" },
                  { label: "Received", value: when.format(i.createdAt) },
                ]}
                action={
                  <Link
                    href={`/admin/inquiries/${i.id}`}
                    className="font-semibold text-leaf underline underline-offset-4"
                  >
                    Open inquiry
                  </Link>
                }
              />
            ))}
          </CardList>

          {page.hasMore && page.nextCursor ? (
            <div className="mt-6 text-center">
              <Link
                href={`/admin/inquiries?${activeStatus ? `status=${activeStatus}&` : ""}cursor=${encodeURIComponent(page.nextCursor)}`}
                className="font-semibold text-leaf underline underline-offset-4"
              >
                Load older
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-full bg-leaf px-4 py-1.5 text-sm font-bold text-white"
          : "rounded-full border-2 border-ink/15 bg-card px-4 py-1.5 text-sm font-bold text-ink-soft hover:border-leaf"
      }
    >
      {label}
    </Link>
  );
}
