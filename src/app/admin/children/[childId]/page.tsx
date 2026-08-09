import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill } from "@/lib/i18n/plural";
import { getChildDetail } from "@/lib/data/children";
import { listClassesForSession } from "@/lib/data/classes";
import { listParentsForPicker } from "@/lib/data/people";

import { ArchiveChildButton, EditChildForm } from "../child-forms";
import {
  DeleteChildForm,
  LinkGuardianForm,
  UnlinkGuardianButton,
} from "./guardian-forms";

export const metadata: Metadata = {
  title: "Child details",
  robots: { index: false, follow: false },
};

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const session = await requireStaff(`/admin/children/${childId}`);
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.children;

  // getChildDetail throws NotFound for a child outside the caller's scope, so a
  // teacher guessing an id from another class gets a 404 — not a 403, which
  // would confirm the child exists.
  let child;
  try {
    child = await getChildDetail(session, childId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const isOwner = session.user.role === "OWNER";
  const fullName = `${child.firstName} ${child.lastName}`;

  const [classes, allParents] = await Promise.all([
    listClassesForSession(session),
    isOwner ? listParentsForPicker(session) : Promise.resolve([]),
  ]);

  const linkedIds = new Set(child.guardianships.map((g) => g.parent.id));
  const availableParents = allParents.filter((p) => !linkedIds.has(p.id));

  return (
    <div>
      <AdminNav current="/admin/children" role={session.user.role} t={dict.admin.nav} />

      <p className="mb-4">
        <Link
          href="/admin/children"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          <span aria-hidden className="rtl:-scale-x-100">
            ←
          </span>{" "}
          {t.allChildren}
        </Link>
      </p>

      <PageHeader
        title={fullName}
        description={[
          child.class?.name ?? t.notAssignedToClass,
          // The stored ISO date, not a formatted one: this is the record staff
          // check against a birth certificate, so it must not shift with locale.
          fill(t.born, { date: child.dateOfBirth.toISOString().slice(0, 10) }),
        ].join(" · ")}
        action={
          isOwner ? (
            <ArchiveChildButton
              childId={child.id}
              childName={child.firstName}
              archived={child.status === "ARCHIVED"}
              t={t}
            />
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {child.status === "ARCHIVED" ? (
          <Badge tone="neutral">{t.leftTheNursery}</Badge>
        ) : (
          <Badge tone="green">{t.enrolled}</Badge>
        )}
        {child.photoConsent ? (
          <Badge tone="green">{t.photoConsentGiven}</Badge>
        ) : (
          <Badge tone="coral">{t.photoConsentWithdrawn}</Badge>
        )}
      </div>

      {child.allergiesNote ? (
        <div className="mb-6 rounded-2xl border-2 border-sun/50 bg-sun-soft px-5 py-4">
          <p className="font-bold">{t.allergiesTitle}</p>
          {/* Staff wrote this note; it stays in whichever script they used. */}
          <p dir="auto" className="mt-1 text-ink-soft">
            {child.allergiesNote}
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>{t.guardians}</SectionTitle>
          <p className="mb-4 text-sm text-ink-soft">
            {fill(t.guardiansNote, { name: child.firstName })}
          </p>

          {child.guardianships.length === 0 ? (
            <p className="mb-5 rounded-xl bg-sun-soft px-4 py-3 text-sm">
              {fill(t.noGuardianLinked, { name: child.firstName })}
            </p>
          ) : (
            <ul className="mb-5 space-y-3">
              {child.guardianships.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {g.parent.name}
                      {g.isPrimary ? (
                        <span className="ms-2">
                          <Badge tone="sky">{t.primary}</Badge>
                        </span>
                      ) : null}
                      {g.parent.status === "INVITED" ? (
                        <span className="ms-2">
                          <Badge tone="yellow">{t.invitePending}</Badge>
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ink-faint">
                      {dict.admin.relationship[g.relationship]} ·{" "}
                      {/* An address is never bidi-reordered. */}
                      <span dir="ltr">{g.parent.email}</span>
                    </p>
                  </div>

                  {isOwner ? (
                    <UnlinkGuardianButton
                      childId={child.id}
                      parentUserId={g.parent.id}
                      parentName={g.parent.name}
                      t={t}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isOwner ? (
            <LinkGuardianForm
              childId={child.id}
              childName={child.firstName}
              parents={availableParents}
              t={t}
              relationships={dict.admin.relationship}
            />
          ) : null}
        </Card>

        {isOwner ? (
          <Card>
            <SectionTitle>{t.detailsTitle}</SectionTitle>
            <EditChildForm
              t={t}
              child={{
                id: child.id,
                firstName: child.firstName,
                lastName: child.lastName,
                dateOfBirth: child.dateOfBirth,
                photoConsent: child.photoConsent,
                allergiesNote: child.allergiesNote,
                class: child.class,
              }}
              classes={classes}
            />
          </Card>
        ) : null}
      </div>

      {isOwner ? (
        <div className="mt-8 rounded-2xl border-2 border-danger/25 bg-coral-soft/40 p-6">
          <SectionTitle>{t.eraseTitle}</SectionTitle>
          <p className="mb-4 max-w-2xl text-sm text-ink-soft">{t.eraseNote}</p>
          <DeleteChildForm childId={child.id} childName={fullName} t={t} />
        </div>
      ) : null}
    </div>
  );
}
