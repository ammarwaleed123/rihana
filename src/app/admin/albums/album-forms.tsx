"use client";

import { useActionState, useState } from "react";
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

  // Controlled so a save doesn't wipe the fields. React 19 resets an
  // uncontrolled form after a form action runs, which snapped the class selector
  // back to "Whole nursery" even though the new class had saved fine (the photos
  // updated, the dropdown did not). Holding the values in state fixes that and
  // preserves what was typed on a validation error.
  //
  // The parent re-mounts this component (via `key`) only when the SAVED values
  // change, i.e. right after a save persists — that is what re-seeds these from
  // the stored album, so the dropdown ends on exactly what was saved.
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [eventDate, setEventDate] = useState(
    defaults?.eventDate?.toISOString().slice(0, 10) ?? "",
  );
  const [classId, setClassId] = useState(
    defaults?.classId ?? (canChooseClass ? "" : (classes[0]?.id ?? "")),
  );

  return (
    <>
      <Field label="Album title" htmlFor={id("title")} error={errors?.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={80}
          placeholder="Graduation Day 2026"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
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
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
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
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
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
        // Re-mounts (re-seeding the controlled fields from the album) only when
        // a saved value actually changes — i.e. after a successful save. While
        // editing, the key is stable, so nothing resets and a validation error
        // keeps what was typed.
        key={`${album.classId ?? ""}|${album.title}|${album.description ?? ""}|${album.eventDate?.toISOString() ?? ""}`}
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
