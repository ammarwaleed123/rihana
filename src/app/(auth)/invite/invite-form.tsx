"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import { acceptInviteAction, type ActionState } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-constants";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Setting up…" : "Set password and continue"}
    </Button>
  );
}

export function InviteForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    acceptInviteAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field
        label="Choose a password"
        htmlFor="password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase you will remember works well.`}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          autoFocus
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
