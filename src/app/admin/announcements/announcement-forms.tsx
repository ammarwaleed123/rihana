"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Disclosure } from "@/components/ui/disclosure";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  type AnnouncementState,
} from "@/lib/admin/announcement-actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type ClassOption = { id: string; name: string };

const controlClass =
  "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink focus:border-leaf focus:outline-none";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Shared fields. Audience is controlled state so the class picker can appear
 * only when it is needed, and the hidden `audience` input carries the choice —
 * a teacher never sees "Whole nursery", and the server refuses it regardless.
 */
function AnnouncementFields({
  t,
  classes,
  canPostNursery,
  errors,
  defaults,
  idPrefix,
}: {
  t: AnnStrings;
  classes: ClassOption[];
  canPostNursery: boolean;
  errors?: Record<string, string>;
  defaults?: {
    title?: string;
    body?: string;
    audience?: "ALL_NURSERY" | "CLASS";
    classId?: string | null;
  };
  idPrefix: string;
}) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const [audience, setAudience] = useState<"ALL_NURSERY" | "CLASS">(
    defaults?.audience ?? (canPostNursery ? "ALL_NURSERY" : "CLASS"),
  );

  return (
    <>
      <input type="hidden" name="audience" value={audience} />

      <Field label={t.titleLabel} htmlFor={id("title")} error={errors?.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={120}
          defaultValue={defaults?.title}
          placeholder={t.titlePlaceholder}
          autoComplete="off"
        />
      </Field>

      <Field
        label={t.audience}
        htmlFor={id("audience")}
        error={errors?.classId}
      >
        {canPostNursery ? (
          <select
            id={id("audience")}
            value={audience}
            onChange={(event) =>
              setAudience(event.target.value as "ALL_NURSERY" | "CLASS")
            }
            className={controlClass}
          >
            <option value="ALL_NURSERY">{t.wholeNursery}</option>
            <option value="CLASS">{t.oneClass}</option>
          </select>
        ) : (
          <p className="text-sm text-ink-soft">
            {t.teacherScopeNote}
          </p>
        )}
      </Field>

      {audience === "CLASS" ? (
        <Field label={t.classLabel} htmlFor={id("classId")} error={errors?.classId}>
          <select
            id={id("classId")}
            name="classId"
            required
            defaultValue={defaults?.classId ?? classes[0]?.id ?? ""}
            className={controlClass}
          >
            {classes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field
        label={t.body}
        htmlFor={id("body")}
        hint={t.bodyHint}
        error={errors?.body}
      >
        <textarea
          id={id("body")}
          name="body"
          rows={6}
          required
          maxLength={5000}
          defaultValue={defaults?.body}
          className={controlClass}
          placeholder={t.bodyPlaceholder}
        />
      </Field>
    </>
  );
}

type AnnStrings = Dictionary["admin"]["announcementForm"];

export function CreateAnnouncementForm({
  t,
  classes,
  canPostNursery,
}: {
  t: AnnStrings;
  classes: ClassOption[];
  canPostNursery: boolean;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    createAnnouncementAction,
    {},
  );

  return (
    <Disclosure label={t.newAnnouncement}>
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <AnnouncementFields t={t}
          classes={classes}
          canPostNursery={canPostNursery}
          errors={state.errors}
          idPrefix="new-ann"
        />
        <Submit label={t.createDraft} pendingLabel={t.creating} />
        <p className="text-sm text-ink-soft">
          {t.draftNote}
        </p>
      </form>
    </Disclosure>
  );
}

export function EditAnnouncementForm({
  t,
  announcement,
  classes,
  canPostNursery,
}: {
  t: AnnStrings;
  announcement: {
    id: string;
    title: string;
    body: string;
    audience: "ALL_NURSERY" | "CLASS";
    classId: string | null;
  };
  classes: ClassOption[];
  canPostNursery: boolean;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    updateAnnouncementAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="announcementId" value={announcement.id} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <AnnouncementFields t={t}
        classes={classes}
        canPostNursery={canPostNursery}
        errors={state.errors}
        idPrefix={`edit-ann-${announcement.id}`}
        defaults={{
          title: announcement.title,
          body: announcement.body,
          audience: announcement.audience,
          classId: announcement.classId,
        }}
      />

      <Submit label={t.saveChanges} pendingLabel={t.saving} />
    </form>
  );
}
