import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/form";
import { getSession, homePathForRole } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";

import { SignInForm } from "./signin-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; activated?: string; reset?: string }>;
}) {
  const params = await searchParams;

  // Already signed in — send them where they belong rather than showing a form
  // they cannot meaningfully use.
  const session = await getSession();
  if (session) redirect(homePathForRole(session.user.role));

  const dict = await getDictionary(await getAppLocale());
  const t = dict.auth;

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      <h1 className="text-3xl font-semibold">{t.signInTitle}</h1>
      <p className="mt-2 text-ink-soft">{t.signInSubtitle}</p>

      <div className="mt-6 space-y-4">
        {params.activated ? <Alert tone="success">{t.activated}</Alert> : null}

        {params.reset ? <Alert tone="success">{t.resetDone}</Alert> : null}

        <SignInForm next={params.next} t={t} />
      </div>

      <p className="mt-8 border-t border-ink/10 pt-6 text-sm text-ink-faint">
        {t.noAccountNote}
      </p>
    </div>
  );
}
