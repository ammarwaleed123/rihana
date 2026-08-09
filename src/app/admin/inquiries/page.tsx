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
import { getDictionary } from "@/lib/i18n";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { getAppLocale } from "@/lib/i18n/app-locale";
import {
  listInquiries,
  type InquiryKindValue,
  type InquiryStatusValue,
} from "@/lib/data/inquiries";
import { INQUIRY_STATUSES } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Inquiries",
  robots: { index: false, follow: false },
};

const statusTone: Record<InquiryStatusValue, Parameters<typeof Badge>[0]["tone"]> = {
  NEW: "coral",
  CONTACTED: "sky",
  TOURED: "yellow",
  ENROLLED: "green",
  CLOSED: "neutral",
};

function StatusBadge({
  status,
  labels,
}: {
  status: InquiryStatusValue;
  labels: Record<InquiryStatusValue, string>;
}) {
  return <Badge tone={statusTone[status]}>{labels[status]}</Badge>;
}

function KindBadge({
  kind,
  t,
}: {
  kind: InquiryKindValue;
  t: { kindVisit: string; kindQuestion: string };
}) {
  return kind === "VISIT" ? (
    <Badge tone="green">{t.kindVisit}</Badge>
  ) : (
    <Badge tone="sky">{t.kindQuestion}</Badge>
  );
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const session = await requireOwner("/admin/inquiries");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);

  // Per request, not at module scope: the formatter depends on the reader.
  const when = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const t = dict.admin.inquiries;
  const params = await searchParams;
  const activeStatus = params.status ?? null;

  const page = await listInquiries(session, {
    status: activeStatus,
    cursor: params.cursor ?? null,
  });

  return (
    <div>
      <AdminNav current="/admin/inquiries" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={t.title}
        description={t.description}
      />

      {/* Status filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip label={t.all} href="/admin/inquiries" active={!activeStatus} />
        {INQUIRY_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={dict.admin.inquiryStatus[s]}
            href={`/admin/inquiries?status=${s}`}
            active={activeStatus === s}
          />
        ))}
      </div>

      {page.items.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyBody}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t.colFamily}</Th>
                <Th>{t.colChild}</Th>
                <Th>{t.colContact}</Th>
                <Th>{t.colStatus}</Th>
                <Th>{t.colReceived}</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((i) => (
                <tr key={i.id}>
                  <Td className="font-semibold">
                    {i.parentName}
                    <div className="mt-1">
                      <KindBadge kind={i.kind} t={t} />
                    </div>
                  </Td>
                  <Td>{i.childFirstName ?? "—"}</Td>
                  <Td className="text-sm text-ink-soft">
                    {i.email}
                    {i.phone ? <br /> : null}
                    {i.phone}
                  </Td>
                  <Td>
                    <StatusBadge status={i.status} labels={dict.admin.inquiryStatus} />
                  </Td>
                  <Td className="text-sm text-ink-soft">{when.format(i.createdAt)}</Td>
                  <Td>
                    <Link
                      href={`/admin/inquiries/${i.id}`}
                      className="font-semibold text-leaf underline underline-offset-4"
                    >
                      {t.open}
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
                badges={
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <KindBadge kind={i.kind} t={t} />
                    <StatusBadge status={i.status} labels={dict.admin.inquiryStatus} />
                  </div>
                }
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
                    {t.openInquiry}
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
                {t.loadOlder}
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
