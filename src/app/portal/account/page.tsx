import type { Metadata } from "next";

import { InstallButton } from "@/components/pwa/install-button";
import { PushToggle } from "@/components/pwa/push-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-constants";
import { requireParent } from "@/lib/auth/scope";
import { getMyAccount, getMyFamily } from "@/lib/data/account";

import { getNotificationPreferences } from "@/lib/data/notifications";

import {
  ChangePasswordForm,
  ContactDetailsForm,
  LanguageForm,
  PreferencesForm,
} from "@/components/account/account-forms";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { toLocale } from "@/lib/i18n/locale-cookie";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await requireParent("/portal/account");

  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const a = dict.portal.account;
  const dateFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const [account, family, prefs] = await Promise.all([
    getMyAccount(session),
    getMyFamily(session),
    getNotificationPreferences(session),
  ]);

  return (
    <div>
      <PageHeader
        title={a.title}
        description={a.descriptionParent}
      />

      <div className="space-y-6">
        <Card>
          <SectionTitle>{a.childrenTitle}</SectionTitle>

          {family.length === 0 ? (
            <p className="text-ink-soft">{a.noChildren}</p>
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
                    <Row
                      label={a.childClass}
                      value={child.class?.name ?? a.classUnassigned}
                    />
                    <Row
                      label={a.childBorn}
                      value={dateFormat.format(child.dateOfBirth)}
                    />
                    {child.relationship ? (
                      <Row
                        label={a.youAre}
                        value={
                          // The stored value is an enum (MOTHER/FATHER/…), so it
                          // is a label to translate, not text the parent typed.
                          dict.portal.relationship[
                            child.relationship as keyof typeof dict.portal.relationship
                          ] ?? child.relationship
                        }
                      />
                    ) : null}
                    <Row
                      label={a.childPhotos}
                      value={
                        child.photoConsent
                          ? a.photosShared
                          : a.photosWithdrawn
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
            {a.recordsNote}
          </p>
        </Card>

        <Card>
          <SectionTitle>{a.detailsTitle}</SectionTitle>
          <ContactDetailsForm
            name={account.name}
            phone={account.phone}
            t={dict.portal.forms}
          />
        </Card>

        <Card>
          <SectionTitle>{a.emailTitle}</SectionTitle>
          {/*
            Read-only. The email is issued by the nursery and is what a password
            reset would be sent to, so it is theirs to change, not the parent's.
            Shown here so the parent knows which address they sign in with.
          */}
          <p className="font-semibold">{account.email}</p>
          <p className="mt-2 text-sm text-ink-soft">{a.emailNoteParent}</p>
        </Card>

        <Card>
          <SectionTitle>{a.languageTitle}</SectionTitle>
          <LanguageForm
            current={toLocale(account.locale)}
            returnTo="/portal/account"
            labels={{
              legend: a.languageLegend,
              save: a.languageSave,
              saving: a.languageSaving,
            }}
          />
        </Card>

        <Card>
          <SectionTitle>{a.notificationsTitle}</SectionTitle>
          <div className="space-y-5">
            <div>
              <p className="mb-2 font-bold text-ink">{a.installApp}</p>
              <InstallButton t={dict.portal.install} />
            </div>
            <div className="border-t border-ink/10 pt-5">
              <p className="mb-2 font-bold text-ink">{a.onThisDevice}</p>
              <PushToggle t={dict.portal.push} />
            </div>
            <div className="border-t border-ink/10 pt-5">
              <p className="mb-3 font-bold text-ink">{a.emailLabel}</p>
              <PreferencesForm defaults={prefs} t={dict.portal.forms} />
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>{a.passwordTitle}</SectionTitle>
          <ChangePasswordForm
            minLength={PASSWORD_MIN_LENGTH}
            t={dict.portal.forms}
          />
        </Card>

        <Card>
          <SectionTitle>{a.signOutTitle}</SectionTitle>
          <p className="mb-4 text-ink-soft">{a.signOutBody}</p>
          <SignOutButton prominent t={dict.portal.signOut} />
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
