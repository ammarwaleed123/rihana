"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Disclosure } from "@/components/ui/disclosure";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  archiveChildAction,
  createChildAction,
  restoreChildAction,
  updateChildAction,
  type FormState,
} from "@/lib/admin/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill } from "@/lib/i18n/plural";

type ClassOption = { id: string; name: string };

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

const selectClass =
  "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink focus:border-leaf focus:outline-none";

/**
 * Shared child fields.
 *
 * The photo-consent checkbox carries an explicit explanation rather than a bare
 * label: the owner is recording a legal permission about a child's image, and
 * the consequence of unchecking it should not have to be inferred.
 */
type ChildStrings = Dictionary["admin"]["children"];

function ChildFields({
  classes,
  errors,
  defaults,
  idPrefix,
  t,
}: {
  t: ChildStrings;
  classes: ClassOption[];
  errors?: Record<string, string>;
  defaults?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    classId?: string | null;
    photoConsent?: boolean;
    allergiesNote?: string | null;
  };
  idPrefix: string;
}) {
  const id = (field: string) => `${idPrefix}-${field}`;

  /*
   * Photo consent is a controlled input.
   *
   * As an uncontrolled `defaultChecked` box, a click landing before React
   * finished hydrating was accepted visually and then reverted by the hydration
   * pass — so the save wrote the old value while appearing to succeed. Silently
   * undoing someone's decision is bad for any control and unacceptable for one
   * that records a legal permission about a child's image.
   */
  const [photoConsent, setPhotoConsent] = useState(
    defaults?.photoConsent ?? true,
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.firstName} htmlFor={id("firstName")} error={errors?.firstName}>
          <Input
            id={id("firstName")}
            name="firstName"
            required
            defaultValue={defaults?.firstName}
            autoComplete="off"
          />
        </Field>

        <Field label={t.lastName} htmlFor={id("lastName")} error={errors?.lastName}>
          <Input
            id={id("lastName")}
            name="lastName"
            required
            defaultValue={defaults?.lastName}
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label={t.dateOfBirth}
        htmlFor={id("dateOfBirth")}
        error={errors?.dateOfBirth}
      >
        <Input
          id={id("dateOfBirth")}
          name="dateOfBirth"
          type="date"
          required
          defaultValue={defaults?.dateOfBirth?.toISOString().slice(0, 10)}
        />
      </Field>

      <Field label={t.classLabel} htmlFor={id("classId")} error={errors?.classId}>
        <select
          id={id("classId")}
          name="classId"
          defaultValue={defaults?.classId ?? ""}
          className={selectClass}
        >
          <option value="">{t.notAssignedYet}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t.allergiesLabel}
        htmlFor={id("allergiesNote")}
        hint={t.allergiesHint}
        error={errors?.allergiesNote}
      >
        <textarea
          id={id("allergiesNote")}
          name="allergiesNote"
          rows={2}
          maxLength={500}
          defaultValue={defaults?.allergiesNote ?? ""}
          className={selectClass}
        />
      </Field>

      <div className="rounded-xl border-2 border-ink/10 bg-card p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="photoConsent"
            checked={photoConsent}
            onChange={(event) => setPhotoConsent(event.target.checked)}
            className="mt-1 size-5 shrink-0 accent-[color:var(--color-leaf)]"
          />
          <span>
            <span className="font-bold">{t.photoConsentGiven}</span>
            <span className="mt-0.5 block text-sm text-ink-soft">
              {t.consentWarning}
            </span>
          </span>
        </label>
      </div>
    </>
  );
}

export function CreateChildForm({
  classes,
  t,
}: {
  classes: ClassOption[];
  t: ChildStrings;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    createChildAction,
    {},
  );

  return (
    <Disclosure label={t.addChild}>
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}

        <ChildFields classes={classes} errors={state.errors} idPrefix="new" t={t} />
        <Submit label={t.addChildSubmit} pendingLabel={t.adding} />
      </form>
    </Disclosure>
  );
}

export function EditChildForm({
  child,
  classes,
  t,
}: {
  t: ChildStrings;
  child: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    photoConsent: boolean;
    allergiesNote: string | null;
    class: { id: string; name: string } | null;
  };
  classes: ClassOption[];
}) {
  const [state, action] = useActionState<FormState, FormData>(
    updateChildAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="childId" value={child.id} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <ChildFields
        t={t}
        classes={classes}
        errors={state.errors}
        idPrefix={`edit-${child.id}`}
        defaults={{
          firstName: child.firstName,
          lastName: child.lastName,
          dateOfBirth: child.dateOfBirth,
          classId: child.class?.id ?? null,
          photoConsent: child.photoConsent,
          allergiesNote: child.allergiesNote,
        }}
      />

      <Submit label={t.saveChanges} pendingLabel={t.saving} />
    </form>
  );
}

export function ArchiveChildButton({
  childId,
  childName,
  archived,
  t,
}: {
  childId: string;
  childName: string;
  archived: boolean;
  t: ChildStrings;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    archived ? restoreChildAction : archiveChildAction,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="childId" value={childId} />
      {state.error ? (
        <p className="mb-2 text-sm font-semibold text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" variant="secondary" className="px-4 py-2 text-sm">
        {fill(archived ? t.restore : t.markLeft, { name: childName })}
      </Button>
    </form>
  );
}
