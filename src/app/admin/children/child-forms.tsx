"use client";

import { useActionState } from "react";
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
function ChildFields({
  classes,
  errors,
  defaults,
  idPrefix,
}: {
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

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor={id("firstName")} error={errors?.firstName}>
          <Input
            id={id("firstName")}
            name="firstName"
            required
            defaultValue={defaults?.firstName}
            autoComplete="off"
          />
        </Field>

        <Field label="Last name" htmlFor={id("lastName")} error={errors?.lastName}>
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
        label="Date of birth"
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

      <Field label="Class" htmlFor={id("classId")} error={errors?.classId}>
        <select
          id={id("classId")}
          name="classId"
          defaultValue={defaults?.classId ?? ""}
          className={selectClass}
        >
          <option value="">Not assigned yet</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Allergies and notes"
        htmlFor={id("allergiesNote")}
        hint="Visible to staff only."
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
            defaultChecked={defaults?.photoConsent ?? true}
            className="mt-1 size-5 shrink-0 accent-[color:var(--color-leaf)]"
          />
          <span>
            <span className="font-bold">Photo consent given</span>
            <span className="mt-0.5 block text-sm text-ink-soft">
              When this is off, the child cannot be tagged in new photos and is
              left out of class albums. Photos already shared with their own
              guardians stay visible.
            </span>
          </span>
        </label>
      </div>
    </>
  );
}

export function CreateChildForm({ classes }: { classes: ClassOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(
    createChildAction,
    {},
  );

  return (
    <Disclosure label="Add a child">
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}

        <ChildFields classes={classes} errors={state.errors} idPrefix="new" />
        <Submit label="Add child" pendingLabel="Adding…" />
      </form>
    </Disclosure>
  );
}

export function EditChildForm({
  child,
  classes,
}: {
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

      <Submit label="Save changes" pendingLabel="Saving…" />
    </form>
  );
}

export function ArchiveChildButton({
  childId,
  childName,
  archived,
}: {
  childId: string;
  childName: string;
  archived: boolean;
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
        {archived ? `Restore ${childName}` : `Mark ${childName} as left`}
      </Button>
    </form>
  );
}
