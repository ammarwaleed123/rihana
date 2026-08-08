import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireParent } from "@/lib/auth/scope";
import { getChildPickupDetail } from "@/lib/data/pickup";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill } from "@/lib/i18n/plural";

import { EditPickupPersonForm } from "../../../pickup-forms";

export const metadata: Metadata = {
  title: "Edit pickup person",
  robots: { index: false, follow: false },
};

/** A `date` input wants YYYY-MM-DD; the stored value is a Date at UTC midnight. */
function toDateInput(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export default async function EditPickupPersonPage({
  params,
}: {
  params: Promise<{ childId: string; personId: string }>;
}) {
  const { childId, personId } = await params;
  const session = await requireParent(
    `/portal/pickup/${childId}/${personId}/edit`,
  );

  const dict = await getDictionary(await getAppLocale());
  const t = dict.portal.pickupForm;

  let detail;
  try {
    detail = await getChildPickupDetail(session, childId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const person = detail.people.find((p) => p.id === personId);
  if (!person) notFound();

  return (
    <div>
      <div className="mb-2">
        <Link
          href={`/portal/pickup/${childId}`}
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          <span aria-hidden className="rtl:-scale-x-100">
            ←
          </span>{" "}
          {fill(t.editBackTo, { name: detail.child.firstName })}
        </Link>
      </div>

      <PageHeader
        title={t.editTitle}
        description={fill(t.editFor, {
          name: `${detail.child.firstName} ${detail.child.lastName}`,
        })}
      />

      <Card>
        <SectionTitle>{person.fullName}</SectionTitle>
        <EditPickupPersonForm
          childId={childId}
          person={{
            id: person.id,
            fullName: person.fullName,
            relationship: person.relationship,
            phone: person.phone,
            expiresAt: toDateInput(person.expiresAt),
            hasPhoto: person.hasPhoto,
          }}
          t={t}
        />
      </Card>
    </div>
  );
}
