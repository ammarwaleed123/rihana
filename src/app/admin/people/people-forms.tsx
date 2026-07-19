"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Disclosure } from "@/components/ui/disclosure";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  disablePersonAction,
  enablePersonAction,
  inviteParentAction,
  inviteTeacherAction,
  reissueInviteAction,
  type FormState,
} from "@/lib/admin/actions";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * The invitation link, shown once after creation.
 *
 * Email delivery arrives in Phase 5. Until then the owner copies this link and
 * sends it themselves, which is also the fallback whenever an email bounces —
 * so this stays useful afterwards.
 */
function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl border-2 border-leaf/30 bg-leaf-soft p-4">
      <p className="font-bold">Invitation link</p>
      <p className="mt-1 text-sm text-ink-soft">
        Send this to them. It works once and expires in 14 days.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-card px-3 py-2 text-xs">
          {url}
        </code>
        <Button
          type="button"
          variant="secondary"
          className="px-4 py-2 text-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

const checkboxListClass =
  "max-h-48 space-y-2 overflow-y-auto rounded-xl border-2 border-ink/15 bg-card p-3";

export function InviteParentForm({
  // Not named `children`: React reserves that prop, and passing a data array
  // through it would be genuinely confusing to read.
  childOptions,
}: {
  childOptions: Array<{ id: string; firstName: string; lastName: string }>;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    inviteParentAction,
    {},
  );

  return (
    <Disclosure label="Invite a parent">
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}
        {state.inviteUrl ? <InviteLink url={state.inviteUrl} /> : null}

        <Field label="Full name" htmlFor="parent-name" error={state.errors?.name}>
          <Input id="parent-name" name="name" required autoComplete="off" />
        </Field>

        <Field label="Email" htmlFor="parent-email" error={state.errors?.email}>
          <Input
            id="parent-email"
            name="email"
            type="email"
            required
            autoComplete="off"
          />
        </Field>

        <Field label="Phone (optional)" htmlFor="parent-phone">
          <Input id="parent-phone" name="phone" type="tel" autoComplete="off" />
        </Field>

        {childOptions.length > 0 ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">
              Link to children
            </legend>
            <p className="mb-2 text-sm text-ink-faint">
              They will see photos of everyone selected here.
            </p>
            <div className={checkboxListClass}>
              {childOptions.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    name="childIds"
                    value={c.id}
                    className="size-4 accent-[color:var(--color-leaf)]"
                  />
                  <span>
                    {c.firstName} {c.lastName}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <Submit label="Create invitation" pendingLabel="Creating…" />
      </form>
    </Disclosure>
  );
}

export function InviteTeacherForm({
  classes,
}: {
  classes: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    inviteTeacherAction,
    {},
  );

  return (
    <Disclosure label="Invite a teacher" variant="secondary">
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}
        {state.inviteUrl ? <InviteLink url={state.inviteUrl} /> : null}

        <Field label="Full name" htmlFor="teacher-name" error={state.errors?.name}>
          <Input id="teacher-name" name="name" required autoComplete="off" />
        </Field>

        <Field label="Email" htmlFor="teacher-email" error={state.errors?.email}>
          <Input
            id="teacher-email"
            name="email"
            type="email"
            required
            autoComplete="off"
          />
        </Field>

        <Field label="Phone (optional)" htmlFor="teacher-phone">
          <Input id="teacher-phone" name="phone" type="tel" autoComplete="off" />
        </Field>

        {classes.length > 0 ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">Assign to classes</legend>
            <p className="mb-2 text-sm text-ink-faint">
              They will see every child in the classes selected here.
            </p>
            <div className={checkboxListClass}>
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    name="classIds"
                    value={c.id}
                    className="size-4 accent-[color:var(--color-leaf)]"
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <Submit label="Create invitation" pendingLabel="Creating…" />
      </form>
    </Disclosure>
  );
}

export function ReissueInviteButton({ userId }: { userId: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    reissueInviteAction,
    {},
  );

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className="text-sm font-semibold text-leaf underline underline-offset-2"
        >
          New invite link
        </button>
      </form>
      {state.inviteUrl ? (
        <div className="mt-2">
          <InviteLink url={state.inviteUrl} />
        </div>
      ) : null}
      {state.error ? (
        <p className="mt-1 text-sm font-semibold text-danger">{state.error}</p>
      ) : null}
    </div>
  );
}

export function TogglePersonButton({
  userId,
  name,
  disabled,
}: {
  userId: string;
  name: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    disabled ? enablePersonAction : disablePersonAction,
    {},
  );

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className={
            disabled
              ? "text-sm font-semibold text-leaf underline underline-offset-2"
              : "text-sm font-semibold text-danger underline underline-offset-2"
          }
          aria-label={`${disabled ? "Re-enable" : "Disable"} ${name}`}
        >
          {disabled ? "Re-enable" : "Disable"}
        </button>
      </form>
      {state.error ? (
        <p className="mt-1 text-sm font-semibold text-danger">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="mt-1 text-sm font-semibold text-leaf-dark">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
