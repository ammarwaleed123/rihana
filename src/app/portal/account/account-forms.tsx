"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  changePasswordAction,
  updateContactDetailsAction,
  updatePreferencesAction,
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

/**
 * Notification preferences.
 *
 * Controlled checkboxes — the same reason the consent box is controlled: an
 * uncontrolled box clicked before hydration can be visually accepted and then
 * reverted, saving the wrong value for a setting people expect to stick.
 */
export function PreferencesForm({
  defaults,
}: {
  defaults: {
    emailNewPhotos: boolean;
    emailAnnouncements: boolean;
    emailPickupUpdates: boolean;
  };
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    updatePreferencesAction,
    {},
  );
  const [prefs, setPrefs] = useState(defaults);

  const toggle = (key: keyof typeof prefs) => (checked: boolean) =>
    setPrefs((current) => ({ ...current, [key]: checked }));

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <p className="text-sm text-ink-soft">
        Choose what you&rsquo;re notified about. These apply to the phone
        notifications that arrive once you add the app to your home screen — the
        in-app bell always shows everything.
      </p>

      <PrefRow
        label="New photos of my child"
        checked={prefs.emailNewPhotos}
        onChange={toggle("emailNewPhotos")}
        name="emailNewPhotos"
      />
      <PrefRow
        label="Announcements from the nursery"
        checked={prefs.emailAnnouncements}
        onChange={toggle("emailAnnouncements")}
        name="emailAnnouncements"
      />
      <PrefRow
        label="Pickup authorisation updates"
        checked={prefs.emailPickupUpdates}
        onChange={toggle("emailPickupUpdates")}
        name="emailPickupUpdates"
      />

      <Submit label="Save preferences" pendingLabel="Saving…" />
    </form>
  );
}

function PrefRow({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border-2 border-ink/10 bg-card p-3">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-[color:var(--color-leaf)]"
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}
