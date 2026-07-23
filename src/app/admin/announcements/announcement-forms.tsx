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
  classes,
  canPostNursery,
  errors,
  defaults,
  idPrefix,
}: {
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

      <Field label="Title" htmlFor={id("title")} error={errors?.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={120}
          defaultValue={defaults?.title}
          placeholder="Closed for the holiday on Monday"
          autoComplete="off"
        />
      </Field>

      <Field
        label="Who is this for?"
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
            <option value="ALL_NURSERY">The whole nursery</option>
            <option value="CLASS">One class</option>
          </select>
        ) : (
          <p className="text-sm text-ink-soft">
            Sent to the families of a class you teach.
          </p>
        )}
      </Field>

      {audience === "CLASS" ? (
        <Field label="Class" htmlFor={id("classId")} error={errors?.classId}>
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
        label="Announcement"
        htmlFor={id("body")}
        hint="Plain text works. **bold**, *italic*, - bullet lists and [links](https://…) are supported."
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
          placeholder={"The nursery will be closed on Monday for the public holiday.\n\nSee you Tuesday!"}
        />
      </Field>
    </>
  );
}

export function CreateAnnouncementForm({
  classes,
  canPostNursery,
}: {
  classes: ClassOption[];
  canPostNursery: boolean;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    createAnnouncementAction,
    {},
  );

  return (
    <Disclosure label="New announcement">
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <AnnouncementFields
          classes={classes}
          canPostNursery={canPostNursery}
          errors={state.errors}
          idPrefix="new-ann"
        />
        <Submit label="Create draft" pendingLabel="Creating…" />
        <p className="text-sm text-ink-soft">
          Nothing is sent until you publish it on the next screen.
        </p>
      </form>
    </Disclosure>
  );
}

export function EditAnnouncementForm({
  announcement,
  classes,
  canPostNursery,
}: {
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

      <AnnouncementFields
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

      <Submit label="Save changes" pendingLabel="Saving…" />
    </form>
  );
}
