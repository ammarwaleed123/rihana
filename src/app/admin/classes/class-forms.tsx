"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Disclosure } from "@/components/ui/disclosure";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  archiveClassAction,
  assignTeacherAction,
  createClassAction,
  unassignTeacherAction,
  type FormState,
} from "@/lib/admin/actions";
import { AGE_GROUPS } from "@/lib/validation";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill } from "@/lib/i18n/plural";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Select({
  id,
  name,
  children,
  defaultValue,
}: {
  id: string;
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink focus:border-leaf focus:outline-none"
    >
      {children}
    </select>
  );
}

type ClassStrings = Dictionary["admin"]["classes"];

export function CreateClassForm({ t }: { t: ClassStrings }) {
  const [state, action] = useActionState<FormState, FormData>(
    createClassAction,
    {},
  );

  return (
    <Disclosure label={t.addClass}>
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}

        <Field label={t.className} htmlFor="name" error={state.errors?.name}>
          <Input id="name" name="name" required placeholder={t.classNamePlaceholder} />
        </Field>

        <Field label={t.ageGroup} htmlFor="ageGroupKey" error={state.errors?.ageGroupKey}>
          <Select id="ageGroupKey" name="ageGroupKey">
            {AGE_GROUPS.map((key) => (
              <option key={key} value={key}>
                {t.ageGroups[key]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t.academicYear}
          htmlFor="academicYear"
          error={state.errors?.academicYear}
        >
          <Input
            id="academicYear"
            name="academicYear"
            required
            defaultValue="2026-2027"
          />
        </Field>

        <Submit label={t.createClass} pendingLabel={t.creating} />
      </form>
    </Disclosure>
  );
}

export function ArchiveClassButton({
  t,
  classId,
  className,
}: {
  classId: string;
  className: string;
  t: ClassStrings;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    archiveClassAction,
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="classId" value={classId} />
      {state.error ? (
        <p className="mb-2 text-sm font-semibold text-danger">{state.error}</p>
      ) : null}
      <Button
        type="submit"
        variant="ghost"
        className="px-3 py-1.5 text-sm text-danger"
        aria-label={fill(t.archiveAria, { name: className })}
      >
        {t.archive}
      </Button>
    </form>
  );
}

export function AssignTeacherForm({
  t,
  classId,
  teachers,
}: {
  classId: string;
  teachers: Array<{ id: string; name: string; email: string }>;
  t: ClassStrings;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    assignTeacherAction,
    {},
  );

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        {t.allTeachersAssigned}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="classId" value={classId} />

      <div className="min-w-56 flex-1">
        <label
          htmlFor={`teacher-${classId}`}
          className="mb-1.5 block text-sm font-bold"
        >
          {t.addTeacher}
        </label>
        <Select id={`teacher-${classId}`} name="userId">
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.email})
            </option>
          ))}
        </Select>
      </div>

      <Submit label={t.assign} pendingLabel={t.assigning} />

      {state.error ? (
        <p className="w-full text-sm font-semibold text-danger">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="w-full text-sm font-semibold text-leaf-dark">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

export function UnassignTeacherButton({
  t,
  classId,
  userId,
  teacherName,
}: {
  classId: string;
  userId: string;
  teacherName: string;
  t: ClassStrings;
}) {
  const [, action] = useActionState<FormState, FormData>(
    unassignTeacherAction,
    {},
  );

  return (
    <form action={action} className="inline">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="text-sm font-semibold text-danger underline underline-offset-2 hover:text-coral-dark"
        aria-label={fill(t.removeAria, { name: teacherName })}
      >
        {t.remove}
      </button>
    </form>
  );
}
