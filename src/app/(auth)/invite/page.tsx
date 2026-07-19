import type { Metadata } from "next";

import { Alert } from "@/components/ui/form";
import { findUserByInviteToken } from "@/lib/data/auth";

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

  if (!user) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
        <h1 className="text-2xl font-semibold">This link is no longer valid</h1>
        <div className="mt-6">
          <Alert tone="error">
            Invitation links expire after 14 days, and can only be used once.
          </Alert>
        </div>
        <p className="mt-6 text-ink-soft">
          Please contact the nursery office and ask them to send you a new
          invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      <h1 className="text-3xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-2 text-ink-soft">
        Choose a password to finish setting up your account for{" "}
        <span className="font-semibold text-ink">{user.email}</span>.
      </p>

      <div className="mt-6">
        <InviteForm token={token!} />
      </div>
    </div>
  );
}
