import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/form";
import { getSession, homePathForRole } from "@/lib/auth/scope";

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

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-8 shadow-pin">
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-ink-soft">
        Sign in to see your child&rsquo;s photos and updates.
      </p>

      <div className="mt-6 space-y-4">
        {params.activated ? (
          <Alert tone="success">
            Your account is ready. Sign in with your new password.
          </Alert>
        ) : null}

        {params.reset ? (
          <Alert tone="success">
            Your password has been changed. Sign in with your new password.
          </Alert>
        ) : null}

        <SignInForm next={params.next} />
      </div>

      <p className="mt-8 border-t border-ink/10 pt-6 text-sm text-ink-faint">
        Accounts are created by the nursery. If you do not have one yet, please
        contact the office and we will send you an invitation.
      </p>
    </div>
  );
}
