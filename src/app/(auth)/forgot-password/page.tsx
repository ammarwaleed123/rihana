import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      <h1 className="text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-ink-soft">
        Enter your email address and we will send you a link to choose a new
        password.
      </p>

      <div className="mt-6">
        <ForgotPasswordForm />
      </div>

      <p className="mt-8 border-t border-ink/10 pt-6 text-center text-sm">
        <Link
          href="/signin"
          className="font-semibold text-leaf underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
