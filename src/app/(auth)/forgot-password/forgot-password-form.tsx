"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  requestPasswordResetAction,
  type ActionState,
} from "@/lib/auth/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type T = Dictionary["auth"];

function SubmitButton({ t }: { t: T }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t.sending : t.sendResetLink}
    </Button>
  );
}

export function ForgotPasswordForm({ t }: { t: T }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    requestPasswordResetAction,
    {},
  );

  // The success message is identical whether or not the address has an account,
  // so the form is replaced entirely rather than left inviting a second guess.
  if (state.success) {
    return <Alert tone="success">{state.success}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label={t.email} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          dir="ltr"
        />
      </Field>

      <SubmitButton t={t} />
    </form>
  );
}
