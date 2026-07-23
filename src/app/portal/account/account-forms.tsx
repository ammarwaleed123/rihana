"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  changePasswordAction,
  updateContactDetailsAction,
  type AccountState,
} from "@/lib/portal/account-actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ContactDetailsForm({
  name,
  phone,
}: {
  name: string;
  phone: string | null;
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    updateContactDetailsAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label="Your name" htmlFor="account-name" error={state.errors?.name}>
        <Input
          id="account-name"
          name="name"
          required
          defaultValue={name}
          autoComplete="name"
        />
      </Field>

      <Field
        label="Phone"
        htmlFor="account-phone"
        hint="Egyptian mobile, e.g. 01012345678. Used by the nursery to reach you. Optional."
        error={state.errors?.phone}
      >
        <Input
          id="account-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="01012345678"
          defaultValue={phone ?? ""}
        />
      </Field>

      <Submit label="Save details" pendingLabel="Saving…" />
    </form>
  );
}


export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [state, action] = useActionState<AccountState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field
        label="Current password"
        htmlFor="current-password"
        error={state.errors?.currentPassword}
      >
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>

      <Field
        label="New password"
        htmlFor="new-password"
        hint={`At least ${minLength} characters. A short phrase you will remember works well.`}
        error={state.errors?.password}
      >
        <Input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={minLength}
          autoComplete="new-password"
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirm-password"
        error={state.errors?.confirmPassword}
      >
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>

      <Submit label="Change password" pendingLabel="Changing…" />
      <p className="text-sm text-ink-soft">
        Changing your password signs out every other device using this account.
      </p>
    </form>
  );
}
