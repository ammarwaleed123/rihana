"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import {
  saveInquiryNotesAction,
  type NotesState,
} from "@/lib/admin/inquiry-actions";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="px-5 py-2.5 text-sm">
      {pending ? "Saving…" : "Save notes"}
    </Button>
  );
}

export function NotesForm({
  inquiryId,
  initialNotes,
}: {
  inquiryId: string;
  initialNotes: string;
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
        placeholder="Private notes — who you spoke to, what was agreed, next steps…"
        className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-leaf focus:outline-none"
      />
      <Save />
    </form>
  );
}
