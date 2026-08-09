"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import { signInAction, type ActionState } from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { PORTAL_ACTIVE_KEY, PORTAL_WARM_KEY } from "@/lib/pwa/portal-lock";

type T = Dictionary["auth"];

/**
 * Mark this browser instance as authenticated here, so the portal's auto-lock
 * can tell a real sign-in from a cold reopen with a restored cookie, and doesn't
 * lock the moment the user lands after signing in.
 */
function markSignedIn() {
  try {
    sessionStorage.setItem(PORTAL_WARM_KEY, "1");
    localStorage.setItem(PORTAL_ACTIVE_KEY, String(Date.now()));
  } catch {
    // Private mode / storage disabled — the lock falls back to its idle timer.
  }
}

function SubmitButton({ t }: { t: T }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t.signingIn : t.signIn}
    </Button>
  );
}

export function SignInForm({ next, t }: { next?: string; t: T }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    signInAction,
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={markSignedIn}
      className="space-y-5"
      noValidate
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label={t.email} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          // An address is left-to-right even on an Arabic page.
          dir="ltr"
          aria-invalid={state.error ? true : undefined}
        />
      </Field>

      <Field label={t.password} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          aria-invalid={state.error ? true : undefined}
        />
      </Field>

      <SubmitButton t={t} />

      <p className="text-center text-sm">
        <Link
          href="/forgot-password"
          className="font-semibold text-leaf underline underline-offset-4"
        >
          {t.forgotPassword}
        </Link>
      </p>
    </form>
  );
}
