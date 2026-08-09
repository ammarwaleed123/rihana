"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import {
  saveInquiryNotesAction,
  type NotesState,
} from "@/lib/admin/inquiry-actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type T = Dictionary["admin"]["inquiries"];

function Save({ t }: { t: T }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="px-5 py-2.5 text-sm">
      {pending ? t.savingNotes : t.saveNotes}
    </Button>
  );
}

export function NotesForm({
  inquiryId,
  initialNotes,
  t,
}: {
  inquiryId: string;
  initialNotes: string;
  t: T;
}) {
  const [state, action] = useActionState<NotesState, FormData>(
    saveInquiryNotesAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <textarea
        name="internalNotes"
        rows={4}
        defaultValue={initialNotes}
        placeholder={t.notesPlaceholder}
        // Staff write these notes in whichever language they think in.
        dir="auto"
        className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-leaf focus:outline-none"
      />
      <Save t={t} />
    </form>
  );
}
