"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  changeEmailAction,
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
        hint="Used by the nursery to reach you. Optional."
        error={state.errors?.phone}
      >
        <Input
          id="account-phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          autoComplete="tel"
        />
      </Field>

      <Submit label="Save details" pendingLabel="Saving…" />
    </form>
  );
}

/**
 * Change email.
 *
 * The password field is not decoration: this address is where a password reset
 * would be sent, so changing it unguarded is a complete account takeover from a
 * borrowed unlocked phone.
 */
export function ChangeEmailForm({ email }: { email: string }) {
  const [state, action] = useActionState<AccountState, FormData>(
    changeEmailAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field
        label="Email address"
        htmlFor="account-email"
        hint="You sign in with this address."
        error={state.errors?.email}
      >
        <Input
          id="account-email"
          name="email"
          type="email"
          required
          defaultValue={email}
          autoComplete="email"
        />
      </Field>

      <Field
        label="Your password"
        htmlFor="email-current-password"
        hint="Confirms it is really you."
        error={state.errors?.currentPassword}
      >
        <Input
          id="email-current-password"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>

      <Submit label="Change email" pendingLabel="Changing…" />
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
