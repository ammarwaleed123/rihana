import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireOwner } from "@/lib/auth/scope";
import { getInquiryDetail } from "@/lib/data/inquiries";
import { setInquiryStatusAction } from "@/lib/admin/inquiry-actions";
import { INQUIRY_STATUSES, inquiryStatusLabels } from "@/lib/validation";

import { NotesForm } from "./notes-form";

export const metadata: Metadata = {
  title: "Inquiry",
  robots: { index: false, follow: false },
};

const longDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dob = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

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

  let inquiry;
  try {
    inquiry = await getInquiryDetail(session, inquiryId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <AdminNav current="/admin/inquiries" role={session.user.role} />

      <div className="mb-2">
        <Link
          href="/admin/inquiries"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← All inquiries
        </Link>
      </div>

      <PageHeader
        title={inquiry.parentName}
        description={`Enquired on ${longDate.format(inquiry.createdAt)}${inquiry.handledBy ? ` · handled by ${inquiry.handledBy.name}` : ""}`}
      />

      {query.updated ? (
        <div className="mb-4">
          <Alert tone="success">Inquiry updated.</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>Details</SectionTitle>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label="Email" value={<a className="text-leaf-dark underline" href={`mailto:${inquiry.email}`}>{inquiry.email}</a>} />
              <Detail
                label="Phone"
                value={
                  inquiry.phone ? (
                    <a className="text-leaf-dark underline" href={`tel:${inquiry.phone}`}>{inquiry.phone}</a>
                  ) : (
                    "—"
                  )
                }
              />
              <Detail label="Child" value={inquiry.childFirstName ?? "—"} />
              <Detail
                label="Child's date of birth"
                value={inquiry.childDateOfBirth ? dob.format(inquiry.childDateOfBirth) : "—"}
              />
              <Detail
                label="Preferred start"
                value={inquiry.preferredStartDate ? dob.format(inquiry.preferredStartDate) : "—"}
              />
            </dl>

            {inquiry.message ? (
              <div className="mt-5 rounded-xl border border-ink/10 bg-paper p-4">
                <p className="text-sm font-bold text-ink-soft">Their message</p>
                <p className="mt-1 whitespace-pre-wrap">{inquiry.message}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>Internal notes</SectionTitle>
            <NotesForm inquiryId={inquiry.id} initialNotes={inquiry.internalNotes ?? ""} />
          </Card>
        </div>

        <Card>
          <SectionTitle>Status</SectionTitle>
          <div className="mb-4">
            <Badge tone="sky">{inquiryStatusLabels[inquiry.status as keyof typeof inquiryStatusLabels]}</Badge>
          </div>
          <p className="mb-3 text-sm text-ink-soft">
            Move this family along as you follow up.
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
                    {inquiryStatusLabels[s]}
                    {current ? " · current" : ""}
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
