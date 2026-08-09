import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/form";
import { findUserByResetToken } from "@/lib/data/auth";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const user = token ? await findUserByResetToken(token) : null;
  const dict = await getDictionary(await getAppLocale());
  const t = dict.auth;

  if (!user) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
        <h1 className="text-2xl font-semibold">{t.resetInvalidTitle}</h1>
        <div className="mt-6">
          <Alert tone="error">{t.resetInvalidBody}</Alert>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-semibold text-leaf underline underline-offset-4"
          >
            {t.requestNewLink}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      <h1 className="text-3xl font-semibold">{t.resetTitle}</h1>
      <p className="mt-2 text-ink-soft">
        {t.forEmail}{" "}
        {/* An address is never bidi-reordered, whichever way the page runs. */}
        <span dir="ltr" className="font-semibold text-ink">
          {user.email}
        </span>
      </p>

      <div className="mt-6">
        <ResetPasswordForm token={token!} t={t} />
      </div>
    </div>
  );
}
