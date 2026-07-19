"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Disclosure } from "@/components/ui/disclosure";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  deleteChildAction,
  linkGuardianAction,
  unlinkGuardianAction,
  type FormState,
} from "@/lib/admin/actions";
import {
  GUARDIAN_RELATIONSHIPS,
  guardianRelationshipLabels,
} from "@/lib/validation";

const selectClass =
  "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink focus:border-leaf focus:outline-none";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function LinkGuardianForm({
  childId,
  childName,
  parents,
}: {
  childId: string;
  childName: string;
  parents: Array<{ id: string; name: string; email: string }>;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    linkGuardianAction,
    {},
  );

  if (parents.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        Every parent account is already linked to {childName}. Invite a new
        parent from the Parents &amp; staff page.
      </p>
    );
  }

  return (
    <Disclosure label="Link a guardian">
      <form action={action} className="space-y-4">
        <input type="hidden" name="childId" value={childId} />

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}

        <Field label="Parent account" htmlFor="parentUserId">
          <select id="parentUserId" name="parentUserId" className={selectClass}>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.email})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Relationship" htmlFor="relationship">
          <select
            id="relationship"
            name="relationship"
            defaultValue="GUARDIAN"
            className={selectClass}
          >
            {GUARDIAN_RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {guardianRelationshipLabels[r]}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="isPrimary"
            className="size-4 accent-[color:var(--color-leaf)]"
          />
          Primary contact
        </label>

        <p className="rounded-xl bg-sun-soft px-4 py-3 text-sm">
          This gives them access to every photo of {childName}, including class
          albums for {childName}&rsquo;s class.
        </p>

        <Submit label="Link guardian" pendingLabel="Linking…" />
      </form>
    </Disclosure>
  );
}

export function UnlinkGuardianButton({
  childId,
  parentUserId,
  parentName,
}: {
  childId: string;
  parentUserId: string;
  parentName: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    unlinkGuardianAction,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="parentUserId" value={parentUserId} />
      {state.error ? (
        <p className="mb-1 text-sm font-semibold text-danger">{state.error}</p>
      ) : null}
      <button
        type="submit"
        className="text-sm font-semibold text-danger underline underline-offset-2 hover:text-coral-dark"
        aria-label={`Remove ${parentName}'s access`}
      >
        Remove access
      </button>
    </form>
  );
}

/**
 * Permanent deletion.
 *
 * Behind a disclosure, requiring the child's full name typed exactly. The
 * confirmation is re-checked on the server — this input is a speed bump for the
 * person clicking, not the control.
 */
export function DeleteChildForm({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    deleteChildAction,
    {},
  );

  return (
    <Disclosure label="Delete permanently" variant="secondary">
      <form action={action} className="space-y-4">
        <input type="hidden" name="childId" value={childId} />

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}

        <Alert tone="error">
          This erases {childName}&rsquo;s record, every guardian link, their
          pickup list, and any photo that shows only {childName}. Photos that
          also show other children are kept. This cannot be undone.
        </Alert>

        <Field
          label={`Type "${childName}" to confirm`}
          htmlFor="confirmName"
          error={state.errors?.confirmName}
        >
          <Input
            id="confirmName"
            name="confirmName"
            required
            autoComplete="off"
            placeholder={childName}
          />
        </Field>

        <Button
          type="submit"
          className="bg-danger text-white hover:bg-coral-dark"
        >
          Permanently delete {childName}
        </Button>
      </form>
    </Disclosure>
  );
}
