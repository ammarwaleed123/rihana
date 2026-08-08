import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/admin-nav";
import {
  ChangePasswordForm,
  ContactDetailsForm,
  LanguageForm,
  PreferencesForm,
} from "@/components/account/account-forms";
import { InstallButton } from "@/components/pwa/install-button";
import { PushToggle } from "@/components/pwa/push-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-constants";
import { requireStaff } from "@/lib/auth/scope";
import { getMyAccount } from "@/lib/data/account";
import { getNotificationPreferences } from "@/lib/data/notifications";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { toLocale } from "@/lib/i18n/locale-cookie";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

/**
 * Staff account page — owner and teachers.
 *
 * The mirror of the parent's /portal/account, and the reason it exists: sign out
 * used to sit in the admin header next to the bell, where it is easy to hit by
 * accident on a phone. It now lives here, deliberately one navigation away, the
 * same as it does for parents.
 *
 * `requireStaff` rather than `requireOwner` — a teacher owns their account too.
 * The underlying data functions scope everything to `session.user.id`, so this
 * page can never show or edit anyone else's details.
 */
export default async function AdminAccountPage() {
  const session = await requireStaff("/admin/account");

  const dict = await getDictionary(await getAppLocale());
  const a = dict.portal.account;

  const [account, prefs] = await Promise.all([
    getMyAccount(session),
    getNotificationPreferences(session),
  ]);

  return (
    <div>
      <AdminNav current="/admin/account" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={a.title}
        description={a.descriptionStaff}
      />

      <div className="space-y-6">
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
          {/* Read-only, exactly as on the parent page: the address is the
              sign-in identity and is managed by the nursery, not self-service. */}
          <p className="font-semibold">{account.email}</p>
          <p className="mt-2 text-sm text-ink-soft">{a.emailNoteStaff}</p>
        </Card>

        <Card>
          <SectionTitle>{a.languageTitle}</SectionTitle>
          <LanguageForm
            current={toLocale(account.locale)}
            returnTo="/admin/account"
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
