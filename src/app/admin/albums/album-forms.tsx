"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Disclosure } from "@/components/ui/disclosure";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import {
  createAlbumAction,
  updateAlbumAction,
  type AlbumFormState,
} from "@/lib/admin/album-actions";

type ClassOption = { id: string; name: string };

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

/**
 * Shared album fields.
 *
 * The class selector is the consequential one: it decides which teachers can
 * edit the album, so the hint says that rather than leaving it to be inferred.
 */
function AlbumFields({
  classes,
  errors,
  defaults,
  idPrefix,
  canChooseClass,
}: {
  classes: ClassOption[];
  errors?: Record<string, string>;
  defaults?: {
    title?: string;
    description?: string | null;
    classId?: string | null;
    eventDate?: Date | null;
  };
  idPrefix: string;
  canChooseClass: boolean;
}) {
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <>
      <Field label="Album title" htmlFor={id("title")} error={errors?.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={80}
          placeholder="Graduation Day 2026"
          defaultValue={defaults?.title}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Description"
        htmlFor={id("description")}
        hint="Optional. Shown to families above the photos."
        error={errors?.description}
      >
        <textarea
          id={id("description")}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={defaults?.description ?? ""}
          className={selectClass}
        />
      </Field>

      <Field
        label="Event date"
        htmlFor={id("eventDate")}
        hint="Optional. The day the photos were taken."
        error={errors?.eventDate}
      >
        <Input
          id={id("eventDate")}
          name="eventDate"
          type="date"
          defaultValue={defaults?.eventDate?.toISOString().slice(0, 10) ?? ""}
        />
      </Field>

      {canChooseClass ? (
        <Field
          label="Class"
          htmlFor={id("classId")}
          hint="Teachers of this class can edit the album. Whole nursery albums are yours alone."
          error={errors?.classId}
        >
          <select
            id={id("classId")}
            name="classId"
            defaultValue={defaults?.classId ?? ""}
            className={selectClass}
          >
            <option value="">Whole nursery</option>
            {classes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field
          label="Class"
          htmlFor={id("classId")}
          hint="You can create albums for the classes you teach."
          error={errors?.classId}
        >
          <select
            id={id("classId")}
            name="classId"
            defaultValue={defaults?.classId ?? classes[0]?.id ?? ""}
            className={selectClass}
            required
          >
            {classes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}

export function CreateAlbumForm({
  classes,
  canChooseClass,
}: {
  classes: ClassOption[];
  canChooseClass: boolean;
}) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    createAlbumAction,
    {},
  );

  return (
    <Disclosure label="New album">
      <form action={action} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <AlbumFields
          classes={classes}
          errors={state.errors}
          idPrefix="new-album"
          canChooseClass={canChooseClass}
        />

        <Submit label="Create album" pendingLabel="Creating…" />
        <p className="text-sm text-ink-soft">
          You will choose the photos next. Nothing is shared until you publish.
        </p>
      </form>
    </Disclosure>
  );
}

export function EditAlbumForm({
  album,
  classes,
  canChooseClass,
}: {
  album: {
    id: string;
    title: string;
    description: string | null;
    classId: string | null;
    eventDate: Date | null;
  };
  classes: ClassOption[];
  canChooseClass: boolean;
}) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    updateAlbumAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="albumId" value={album.id} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <AlbumFields
        classes={classes}
        errors={state.errors}
        idPrefix={`edit-album-${album.id}`}
        canChooseClass={canChooseClass}
        defaults={{
          title: album.title,
          description: album.description,
          classId: album.classId,
          eventDate: album.eventDate,
        }}
      />

      <Submit label="Save details" pendingLabel="Saving…" />
    </form>
  );
}
