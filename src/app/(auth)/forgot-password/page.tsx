import type { Metadata } from "next";
import Link from "next/link";

import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  const dict = await getDictionary(await getAppLocale());
  const t = dict.auth;

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      <h1 className="text-3xl font-semibold">{t.forgotTitle}</h1>
      <p className="mt-2 text-ink-soft">{t.forgotSubtitle}</p>

      <div className="mt-6">
        <ForgotPasswordForm t={t} />
      </div>

      <p className="mt-8 border-t border-ink/10 pt-6 text-center text-sm">
        <Link
          href="/signin"
          className="font-semibold text-leaf underline underline-offset-4"
        >
          {t.backToSignIn}
        </Link>
      </p>
    </div>
  );
}
