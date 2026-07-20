"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button, Field } from "@/components/ui/form";
import {
  addPhotosAction,
  uploadPhotosAction,
  type PhotoFormState,
} from "@/lib/admin/photo-actions";

const selectClass =
  "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink focus:border-leaf focus:outline-none";

function UploadButton({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? `Uploading ${count} photo${count === 1 ? "" : "s"}…`
        : count === 0
          ? "Choose photos first"
          : `Upload ${count} photo${count === 1 ? "" : "s"}`}
    </Button>
  );
}

function RejectedList({
  rejected,
}: {
  rejected: Array<{ filename: string; reason: string }>;
}) {
  return (
    <Alert tone="error">
      <p className="mb-1">These files were not used:</p>
      <ul className="list-inside list-disc">
        {rejected.map((r) => (
          <li key={r.filename}>
            {r.filename} — {r.reason}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

export function UploadForm({
  classes,
}: {
  classes: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState<PhotoFormState, FormData>(
    uploadPhotosAction,
    {},
  );
  const [count, setCount] = useState(0);

  if (classes.length === 0) {
    return (
      <Alert tone="info">
        You are not assigned to a class yet, so there is nowhere to upload to.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.rejected ? <RejectedList rejected={state.rejected} /> : null}

      <Field label="Class" htmlFor="classId">
        <select id="classId" name="classId" required className={selectClass}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Photos"
        htmlFor="photos"
        hint="JPEG, PNG, HEIC or WebP. Location data is removed from every photo before it is stored."
      >
        <input
          id="photos"
          name="photos"
          type="file"
          accept="image/*"
          multiple
          required
          onChange={(event) => setCount(event.target.files?.length ?? 0)}
          className="w-full rounded-xl border-2 border-dashed border-ink/20 bg-card px-4 py-6 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-leaf file:px-4 file:py-2 file:font-bold file:text-white"
        />
      </Field>

      <UploadButton count={count} />
    </form>
  );
}

/** Add more photos to an upload that has not been published yet. */
export function AddPhotosForm({ uploadSessionId }: { uploadSessionId: string }) {
  const [state, action] = useActionState<PhotoFormState, FormData>(
    addPhotosAction,
    {},
  );
  const [count, setCount] = useState(0);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="uploadSessionId" value={uploadSessionId} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.rejected ? <RejectedList rejected={state.rejected} /> : null}

      <label htmlFor="more-photos" className="block text-sm font-bold">
        Add more photos
      </label>
      <input
        id="more-photos"
        name="photos"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => setCount(event.target.files?.length ?? 0)}
        className="w-full rounded-xl border-2 border-dashed border-ink/20 bg-card px-4 py-4 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-leaf file:px-4 file:py-2 file:font-bold file:text-white"
      />

      <UploadButton count={count} />
    </form>
  );
}
