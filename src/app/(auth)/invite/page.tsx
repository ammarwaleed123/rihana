import type { Metadata } from "next";

import { Alert } from "@/components/ui/form";
import { findUserByInviteToken } from "@/lib/data/auth";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill } from "@/lib/i18n/plural";

import { InviteForm } from "./invite-form";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Validated here so an expired link shows a clear explanation rather than a
  // password form that fails on submit.
  const user = token ? await findUserByInviteToken(token) : null;
  const dict = await getDictionary(await getAppLocale());
  const t = dict.auth;

  if (!user) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
        <h1 className="text-2xl font-semibold">{t.inviteInvalidTitle}</h1>
        <div className="mt-6">
          <Alert tone="error">{t.inviteInvalidBody}</Alert>
        </div>
        <p className="mt-6 text-ink-soft">{t.inviteInvalidHelp}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      {/* Their own name, in whichever script the nursery entered it. */}
      <h1 dir="auto" className="text-3xl font-semibold">
        {fill(t.welcomeName, { name: user.name })}
      </h1>
      <p className="mt-2 text-ink-soft">
        {t.inviteSubtitleBefore}{" "}
        <span dir="ltr" className="font-semibold text-ink">
          {user.email}
        </span>
        .
      </p>

      <div className="mt-6">
        <InviteForm token={token!} t={t} />
      </div>
    </div>
  );
}
