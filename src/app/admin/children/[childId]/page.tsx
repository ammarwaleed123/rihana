import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { getChildDetail } from "@/lib/data/children";
import { listClassesForSession } from "@/lib/data/classes";
import { listParentsForPicker } from "@/lib/data/people";
import { guardianRelationshipLabels } from "@/lib/validation";

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
  const dict = await getDictionary(await getAppLocale());

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
          ← All children
        </Link>
      </p>

      <PageHeader
        title={fullName}
        description={
          child.class
            ? `${child.class.name} · born ${child.dateOfBirth.toISOString().slice(0, 10)}`
            : `Not assigned to a class · born ${child.dateOfBirth.toISOString().slice(0, 10)}`
        }
        action={
          isOwner ? (
            <ArchiveChildButton
              childId={child.id}
              childName={child.firstName}
              archived={child.status === "ARCHIVED"}
            />
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {child.status === "ARCHIVED" ? (
          <Badge tone="neutral">Left the nursery</Badge>
        ) : (
          <Badge tone="green">Enrolled</Badge>
        )}
        {child.photoConsent ? (
          <Badge tone="green">{dict.admin.children.photoConsentGiven}</Badge>
        ) : (
          <Badge tone="coral">Photo consent withdrawn</Badge>
        )}
      </div>

      {child.allergiesNote ? (
        <div className="mb-6 rounded-2xl border-2 border-sun/50 bg-sun-soft px-5 py-4">
          <p className="font-bold">Allergies and notes</p>
          <p className="mt-1 text-ink-soft">{child.allergiesNote}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Guardians</SectionTitle>
          <p className="mb-4 text-sm text-ink-soft">
            Only these people can see {child.firstName}&rsquo;s photos.
          </p>

          {child.guardianships.length === 0 ? (
            <p className="mb-5 rounded-xl bg-sun-soft px-4 py-3 text-sm">
              No guardian is linked yet, so nobody receives {child.firstName}
              &rsquo;s photos.
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
                        <span className="ml-2">
                          <Badge tone="sky">Primary</Badge>
                        </span>
                      ) : null}
                      {g.parent.status === "INVITED" ? (
                        <span className="ml-2">
                          <Badge tone="yellow">Invite pending</Badge>
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ink-faint">
                      {guardianRelationshipLabels[g.relationship]} ·{" "}
                      {g.parent.email}
                    </p>
                  </div>

                  {isOwner ? (
                    <UnlinkGuardianButton
                      childId={child.id}
                      parentUserId={g.parent.id}
                      parentName={g.parent.name}
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
            />
          ) : null}
        </Card>

        {isOwner ? (
          <Card>
            <SectionTitle>Details</SectionTitle>
            <EditChildForm
              t={dict.admin.children}
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
          <SectionTitle>Erase this record</SectionTitle>
          <p className="mb-4 max-w-2xl text-sm text-ink-soft">
            Use this when a family asks for their data to be deleted. If the
            child has simply left, mark them as left instead — that keeps their
            photos available to their guardians.
          </p>
          <DeleteChildForm childId={child.id} childName={fullName} />
        </div>
      ) : null}
    </div>
  );
}
