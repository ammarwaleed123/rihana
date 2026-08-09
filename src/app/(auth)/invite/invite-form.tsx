"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import { acceptInviteAction, type ActionState } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-constants";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill } from "@/lib/i18n/plural";

type T = Dictionary["auth"];

function SubmitButton({ t }: { t: T }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t.settingUp : t.setPasswordAndContinue}
    </Button>
  );
}

export function InviteForm({ token, t }: { token: string; t: T }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    acceptInviteAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field
        label={t.choosePassword}
        htmlFor="password"
        hint={fill(t.choosePasswordHint, { n: PASSWORD_MIN_LENGTH })}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          autoFocus
          dir="ltr"
        />
      </Field>

      <Field label={t.confirmPassword} htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
        />
      </Field>

      <SubmitButton t={t} />
    </form>
  );
}
