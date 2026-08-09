"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill } from "@/lib/i18n/plural";
import {
  changePasswordAction,
  updateContactDetailsAction,
  updateLocaleAction,
  updatePreferencesAction,
  type AccountState,
} from "@/lib/portal/account-actions";

type FormStrings = Dictionary["portal"]["forms"];

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
  t,
}: {
  name: string;
  phone: string | null;
  t: FormStrings;
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    updateContactDetailsAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label={t.yourName} htmlFor="account-name" error={state.errors?.name}>
        <Input
          id="account-name"
          name="name"
          required
          defaultValue={name}
          autoComplete="name"
        />
      </Field>

      <Field
        label={t.phone}
        htmlFor="account-phone"
        hint={t.phoneHint}
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

      <Submit label={t.saveDetails} pendingLabel={t.saving} />
    </form>
  );
}


export function ChangePasswordForm({
  minLength,
  t,
}: {
  minLength: number;
  t: FormStrings;
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field
        label={t.currentPassword}
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
        label={t.newPassword}
        htmlFor="new-password"
        hint={fill(t.newPasswordHint, { min: minLength })}
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
        label={t.confirmNewPassword}
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

      <Submit label={t.changePassword} pendingLabel={t.changing} />
      <p className="text-sm text-ink-soft">{t.passwordSignsOutNote}</p>
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
/**
 * Interface language.
 *
 * Each option is written in its own language — someone who cannot read the
 * current interface must still be able to find their way out of it. Submitting
 * reloads the shell in the new direction, so no confirmation step is needed:
 * the result is immediately visible and immediately reversible.
 */
/** Where the scroll position waits while the page reloads. */
const SCROLL_KEY = "rihana_account_scroll";

export function LanguageForm({
  current,
  labels,
  returnTo,
}: {
  current: Locale;
  labels: { legend: string; save: string; saving: string };
  /** Which account page to come back to; validated against a fixed list server-side. */
  returnTo: string;
}) {
  const [state, action] = useActionState<AccountState, FormData>(
    updateLocaleAction,
    {},
  );
  const [choice, setChoice] = useState<Locale>(current);

  /*
   * A full page load, not a router push. `<html lang dir>` comes from the root
   * layout, which a soft navigation never re-renders — so without this the
   * interface would keep the old language until the next hard reload, and the
   * save would look like it had not worked.
   *
   * A full load also scrolls to the top, which put the language buttons off
   * screen the instant you used them — the page appeared to jump away and the
   * confirmation was never seen. So the position is stashed just before the
   * reload and restored on the way back in. sessionStorage rather than state,
   * because nothing in this component survives the navigation.
   */
  const reloadTo = state.reloadTo;
  useEffect(() => {
    if (!reloadTo) return;
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      // Private mode: the language still saves, the page just starts at the top.
    }
    window.location.assign(reloadTo);
  }, [reloadTo]);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved !== null) sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      return;
    }
    if (saved === null) return;

    const y = Number(saved);
    if (!Number.isFinite(y)) return;

    /*
     * After the browser's own scroll restoration has had its go, or it would
     * overwrite this a frame later. "instant" because the page has only just
     * appeared — an animated scroll from the top would be the very jump this
     * is meant to remove.
     */
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    });
  }, []);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <fieldset>
        <legend className="mb-2 block text-sm font-bold text-ink">
          {labels.legend}
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setChoice(code)}
              aria-pressed={choice === code}
              lang={code}
              className={cn(
                "rounded-xl border-2 px-4 py-2.5 font-bold transition-colors",
                choice === code
                  ? "border-leaf bg-leaf text-white"
                  : "border-ink/15 bg-card text-ink-soft hover:border-leaf hover:text-ink",
              )}
            >
              {LOCALE_LABEL[code]}
            </button>
          ))}
        </div>
      </fieldset>

      <input type="hidden" name="locale" value={choice} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Submit label={labels.save} pendingLabel={labels.saving} />
    </form>
  );
}

export function PreferencesForm({
  defaults,
  t,
}: {
  defaults: {
    emailNewPhotos: boolean;
    emailAnnouncements: boolean;
    emailPickupUpdates: boolean;
  };
  t: FormStrings;
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

      <p className="text-sm text-ink-soft">{t.prefsIntro}</p>

      <PrefRow
        label={t.prefNewPhotos}
        checked={prefs.emailNewPhotos}
        onChange={toggle("emailNewPhotos")}
        name="emailNewPhotos"
      />
      <PrefRow
        label={t.prefAnnouncements}
        checked={prefs.emailAnnouncements}
        onChange={toggle("emailAnnouncements")}
        name="emailAnnouncements"
      />
      <PrefRow
        label={t.prefPickup}
        checked={prefs.emailPickupUpdates}
        onChange={toggle("emailPickupUpdates")}
        name="emailPickupUpdates"
      />

      <Submit label={t.savePreferences} pendingLabel={t.saving} />
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
