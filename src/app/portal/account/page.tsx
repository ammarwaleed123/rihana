import type { Metadata } from "next";

import { Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-constants";
import { requireParent } from "@/lib/auth/scope";
import { getMyAccount, getMyFamily } from "@/lib/data/account";
import { guardianRelationshipLabels } from "@/lib/validation";

import { ChangePasswordForm, ContactDetailsForm } from "./account-forms";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AccountPage() {
  const session = await requireParent("/portal/account");

  const [account, family] = await Promise.all([
    getMyAccount(session),
    getMyFamily(session),
  ]);

  return (
    <div>
      <PageHeader
        title="Your account"
        description="Your details, your children, and your sign-in settings."
      />

      <div className="space-y-6">
        <Card>
          <SectionTitle>Your children</SectionTitle>

          {family.length === 0 ? (
            <p className="text-ink-soft">
              No children are linked to your account yet. Please contact the
              nursery.
            </p>
          ) : (
            <ul className="space-y-4">
              {family.map((child) => (
                <li
                  key={child.id}
                  className="rounded-xl border border-ink/10 bg-paper p-4"
                >
                  <p className="font-display text-lg font-semibold">
                    {child.firstName} {child.lastName}
                  </p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row label="Class" value={child.class?.name ?? "Not assigned"} />
                    <Row
                      label="Born"
                      value={dateFormat.format(child.dateOfBirth)}
                    />
                    {child.relationship ? (
                      <Row
                        label="You are"
                        value={
                          guardianRelationshipLabels[
                            child.relationship as keyof typeof guardianRelationshipLabels
                          ] ?? child.relationship
                        }
                      />
                    ) : null}
                    <Row
                      label="Photos"
                      value={
                        child.photoConsent
                          ? "Shared with you"
                          : "Not shared — photo consent has been withdrawn"
                      }
                    />
                  </dl>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-sm text-ink-soft">
            {/*
              Stated rather than left to be discovered. A parent who wants their
              child untagged from photos needs to know who can do that, and the
              answer is not "a setting on this page" — it is a decision the
              nursery records as the data controller.
            */}
            To change a class, a name, or whether photos of your child may be
            shared, please contact the nursery. They keep these records.
          </p>
        </Card>

        <Card>
          <SectionTitle>Your details</SectionTitle>
          <ContactDetailsForm name={account.name} phone={account.phone} />
        </Card>

        <Card>
          <SectionTitle>Email address</SectionTitle>
          {/*
            Read-only. The email is issued by the nursery and is what a password
            reset would be sent to, so it is theirs to change, not the parent's.
            Shown here so the parent knows which address they sign in with.
          */}
          <p className="font-semibold">{account.email}</p>
          <p className="mt-2 text-sm text-ink-soft">
            This is the address you sign in with. It is set by the nursery — if
            it is wrong, please contact them and they will correct it.
          </p>
        </Card>

        <Card>
          <SectionTitle>Password</SectionTitle>
          <ChangePasswordForm minLength={PASSWORD_MIN_LENGTH} />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-20 shrink-0 font-bold text-ink-soft">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
