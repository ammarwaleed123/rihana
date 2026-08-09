"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  addPickupPersonAction,
  setPickupMethodAction,
  updatePickupPersonAction,
  type PickupState,
} from "@/lib/portal/pickup-actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Suggestions only — the field accepts anything a parent types.
 * Translated, because "Grandmother" in a datalist is no use to an Arabic reader.
 */
type PickupStrings = Dictionary["portal"]["pickupForm"];

type PersonDefaults = {
  fullName?: string;
  relationship?: string;
  phone?: string;
  expiresAt?: string;
};

function PersonFields({
  errors,
  defaults,
  hasPhoto,
  personId,
  t,
}: {
  errors?: Record<string, string>;
  defaults?: PersonDefaults;
  hasPhoto?: boolean;
  personId?: string;
  t: PickupStrings;
}) {
  return (
    <>
      <Field label={t.fullName} htmlFor="pickup-name" error={errors?.fullName}>
        <Input
          id="pickup-name"
          name="fullName"
          required
          autoComplete="off"
          defaultValue={defaults?.fullName}
          placeholder={t.fullNamePlaceholder}
        />
      </Field>

      <Field
        label={t.relationship}
        htmlFor="pickup-relationship"
        hint={t.relationshipHint}
        error={errors?.relationship}
      >
        <Input
          id="pickup-relationship"
          name="relationship"
          required
          list="relationship-suggestions"
          autoComplete="off"
          defaultValue={defaults?.relationship}
        />
        <datalist id="relationship-suggestions">
          {t.relationshipSuggestions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </Field>

      <Field
        label={t.phone}
        htmlFor="pickup-phone"
        hint={t.phoneHint}
        error={errors?.phone}
      >
        <Input
          id="pickup-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          autoComplete="off"
          placeholder="01012345678"
          defaultValue={defaults?.phone}
        />
      </Field>

      <Field
        label={t.expires}
        htmlFor="pickup-expires"
        hint={t.expiresHint}
        error={errors?.expiresAt}
      >
        <Input
          id="pickup-expires"
          name="expiresAt"
          type="date"
          defaultValue={defaults?.expiresAt}
        />
      </Field>

      <Field
        label={t.photo}
        htmlFor="pickup-photo"
        hint={t.photoHint}
        error={errors?.photo}
      >
        {hasPhoto && personId ? (
          <div className="mb-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/img/pickup/${personId}?v=thumb`}
              alt=""
              className="size-16 rounded-full object-cover"
            />
            <span className="text-sm text-ink-soft">{t.photoCurrent}</span>
          </div>
        ) : null}
        <Input
          id="pickup-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="file:mr-3 file:rounded-full file:border-0 file:bg-leaf-soft file:px-4 file:py-2 file:font-bold file:text-leaf-dark"
        />
      </Field>
    </>
  );
}

/**
 * The password re-entry every safety-critical change ends with.
 *
 * `id` is required because the child page shows two of these at once (the method
 * form and the add form); a shared id would be a duplicate on the page and make
 * the label ambiguous.
 */
function ConfirmPassword({
  id,
  error,
  t,
}: {
  id: string;
  error?: string;
  t: PickupStrings;
}) {
  return (
    <Field
      label={t.confirmPassword}
      htmlFor={id}
      hint={t.confirmPasswordHint}
      error={error}
    >
      <Input
        id={id}
        name="currentPassword"
        type="password"
        required
        // "new-password", not "current-password", is the reliable way to stop a
        // browser or password manager pre-filling this: it keeps the field blank
        // so the parent types their password themselves (the point of a re-auth),
        // and it also breaks the "this is a login form" heuristic that was filling
        // the saved email into the phone field above.
        autoComplete="new-password"
      />
    </Field>
  );
}

export function AddPickupPersonForm({
  childId,
  t,
}: {
  childId: string;
  t: PickupStrings;
}) {
  const [state, action] = useActionState<PickupState, FormData>(
    addPickupPersonAction,
    {},
  );

  return (
    <form action={action} className="space-y-4" autoComplete="off">
      <input type="hidden" name="childId" value={childId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <PersonFields errors={state.errors} t={t} />
      <ConfirmPassword
        id="add-password"
        error={state.errors?.currentPassword}
        t={t}
      />

      <Submit label={t.sendForApproval} pendingLabel={t.sending} />
      <p className="text-sm text-ink-soft">{t.reviewNote}</p>
    </form>
  );
}

export function EditPickupPersonForm({
  childId,
  person,
  t,
}: {
  childId: string;
  t: PickupStrings;
  person: {
    id: string;
    fullName: string;
    relationship: string;
    phone: string;
    expiresAt: string | null;
    hasPhoto: boolean;
  };
}) {
  const [state, action] = useActionState<PickupState, FormData>(
    updatePickupPersonAction,
    {},
  );

  return (
    <form action={action} className="space-y-4" autoComplete="off">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="pickupPersonId" value={person.id} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Alert tone="info">{t.editResubmitNote}</Alert>

      <PersonFields
        errors={state.errors}
        defaults={{
          fullName: person.fullName,
          relationship: person.relationship,
          phone: person.phone,
          expiresAt: person.expiresAt ?? undefined,
        }}
        hasPhoto={person.hasPhoto}
        personId={person.id}
        t={t}
      />
      <ConfirmPassword
        id="edit-password"
        error={state.errors?.currentPassword}
        t={t}
      />

      <Submit label={t.saveChanges} pendingLabel={t.saving} />
    </form>
  );
}

export function PickupMethodForm({
  childId,
  method,
  t,
}: {
  childId: string;
  method: "HANDOVER" | "BUS";
  t: PickupStrings;
}) {
  const [state, action] = useActionState<PickupState, FormData>(
    setPickupMethodAction,
    {},
  );

  return (
    <form action={action} className="space-y-4" autoComplete="off">
      <input type="hidden" name="childId" value={childId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {/*
        Keyed on `method` so that after a save the radio group re-mounts and
        reflects the newly-saved arrangement — `defaultChecked` only applies on
        mount, and revalidation refreshes the page without remounting the form.
        The key is on the fieldset, not the form, so the success message (which
        the form owns via useActionState) survives.
      */}
      <fieldset key={method} className="space-y-2">
        <legend className="mb-1 text-sm font-bold text-ink">
          {t.methodLegend}
        </legend>
        <MethodRadio
          value="HANDOVER"
          label={t.methodHandover}
          description={t.methodHandoverDesc}
          defaultChecked={method === "HANDOVER"}
        />
        <MethodRadio
          value="BUS"
          label={t.methodBus}
          description={t.methodBusDesc}
          defaultChecked={method === "BUS"}
        />
      </fieldset>

      <ConfirmPassword
        id="method-password"
        error={state.errors?.currentPassword}
        t={t}
      />

      <Submit label={t.saveArrangement} pendingLabel={t.saving} />
    </form>
  );
}

function MethodRadio({
  value,
  label,
  description,
  defaultChecked,
}: {
  value: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border-2 border-ink/10 bg-card p-3 has-[:checked]:border-leaf has-[:checked]:bg-leaf-soft/30">
      <input
        type="radio"
        name="method"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1 size-5 shrink-0 accent-[color:var(--color-leaf)]"
      />
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-ink-soft">{description}</span>
      </span>
    </label>
  );
}
