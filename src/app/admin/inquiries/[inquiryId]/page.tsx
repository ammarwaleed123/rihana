import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireOwner } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { getInquiryDetail } from "@/lib/data/inquiries";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/plural";
import { setInquiryStatusAction } from "@/lib/admin/inquiry-actions";
import { INQUIRY_STATUSES } from "@/lib/validation";

import { NotesForm } from "./notes-form";

export const metadata: Metadata = {
  title: "Inquiry",
  robots: { index: false, follow: false },
};

export default async function InquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ inquiryId: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { inquiryId } = await params;
  const query = await searchParams;
  const session = await requireOwner(`/admin/inquiries/${inquiryId}`);
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.inquiries;
  const longDate = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric", month: "long", year: "numeric",
  });
  const dob = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric", month: "short", year: "numeric",
  });

  let inquiry;
  try {
    inquiry = await getInquiryDetail(session, inquiryId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <AdminNav current="/admin/inquiries" role={session.user.role} t={dict.admin.nav} />

      <div className="mb-2">
        <Link
          href="/admin/inquiries"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          <span aria-hidden className="rtl:-scale-x-100">
            ←
          </span>{" "}
          {t.allInquiries}
        </Link>
      </div>

      <PageHeader
        title={inquiry.parentName}
        description={`${inquiry.kind === "VISIT" ? t.requestedVisitOn : t.enquiredOn} ${longDate.format(inquiry.createdAt)}${inquiry.handledBy ? ` · ${fill(t.handledBy, { name: inquiry.handledBy.name })}` : ""}`}
        action={
          inquiry.kind === "VISIT" ? (
            <Badge tone="green">{t.kindVisit}</Badge>
          ) : (
            <Badge tone="sky">{t.kindQuestion}</Badge>
          )
        }
      />

      {query.updated ? (
        <div className="mb-4">
          <Alert tone="success">{t.updated}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>{t.details}</SectionTitle>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label={t.email} value={<a className="text-leaf-dark underline" href={`mailto:${inquiry.email}`}>{inquiry.email}</a>} />
              <Detail
                label={t.phone}
                value={
                  inquiry.phone ? (
                    <a className="text-leaf-dark underline" href={`tel:${inquiry.phone}`}>{inquiry.phone}</a>
                  ) : (
                    "—"
                  )
                }
              />
              <Detail label={t.colChild} value={inquiry.childFirstName ?? "—"} />
              <Detail
                label={t.childDob}
                value={inquiry.childDateOfBirth ? dob.format(inquiry.childDateOfBirth) : "—"}
              />
              <Detail
                label={t.preferredStart}
                value={inquiry.preferredStartDate ? dob.format(inquiry.preferredStartDate) : "—"}
              />
              {inquiry.kind === "VISIT" ? (
                <Detail label={t.preferredVisit} value={inquiry.preferredVisit ?? "—"} />
              ) : null}
            </dl>

            {inquiry.message ? (
              <div className="mt-5 rounded-xl border border-ink/10 bg-paper p-4">
                <p className="text-sm font-bold text-ink-soft">{t.theirMessage}</p>
                <p className="mt-1 whitespace-pre-wrap">{inquiry.message}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>{t.internalNotes}</SectionTitle>
            <NotesForm
              inquiryId={inquiry.id}
              initialNotes={inquiry.internalNotes ?? ""}
              t={t}
            />
          </Card>
        </div>

        <Card>
          <SectionTitle>{t.statusTitle}</SectionTitle>
          <div className="mb-4">
            <Badge tone="sky">
              {dict.admin.inquiryStatus[
                inquiry.status as keyof typeof dict.admin.inquiryStatus
              ]}
            </Badge>
          </div>
          <p className="mb-3 text-sm text-ink-soft">
            {t.statusHelp}
          </p>
          <div className="flex flex-col gap-2">
            {INQUIRY_STATUSES.map((s) => {
              const current = s === inquiry.status;
              return (
                <form key={s} action={setInquiryStatusAction}>
                  <input type="hidden" name="inquiryId" value={inquiry.id} />
                  <input type="hidden" name="status" value={s} />
                  <button
                    type="submit"
                    disabled={current}
                    className={
                      current
                        ? "w-full rounded-xl border-2 border-leaf bg-leaf-soft px-4 py-2.5 text-left font-bold text-leaf-dark"
                        : "w-full rounded-xl border-2 border-ink/12 bg-card px-4 py-2.5 text-left font-bold text-ink transition-colors hover:border-leaf"
                    }
                  >
                    {dict.admin.inquiryStatus[s]}
                    {current ? ` · ${t.current}` : ""}
                  </button>
                </form>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-bold text-ink-soft">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
