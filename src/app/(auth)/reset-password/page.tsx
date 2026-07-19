import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/form";
import { findUserByResetToken } from "@/lib/data/auth";

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

  if (!user) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
        <h1 className="text-2xl font-semibold">This link is no longer valid</h1>
        <div className="mt-6">
          <Alert tone="error">
            Reset links expire after one hour, and can only be used once.
          </Alert>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-semibold text-leaf underline underline-offset-4"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-2 text-ink-soft">
        For <span className="font-semibold text-ink">{user.email}</span>
      </p>

      <div className="mt-6">
        <ResetPasswordForm token={token!} />
      </div>
    </div>
  );
}
