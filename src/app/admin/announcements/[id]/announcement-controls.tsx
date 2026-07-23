"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import {
  deleteAnnouncementAction,
  publishAnnouncementAction,
  unpublishAnnouncementAction,
  type AnnouncementState,
} from "@/lib/admin/announcement-actions";

function Pending({
  label,
  pendingLabel,
  ...rest
}: { label: string; pendingLabel: string } & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...rest}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function PublishAnnouncementForm({
  announcementId,
  audienceLabel,
}: {
  announcementId: string;
  audienceLabel: string;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    publishAnnouncementAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="announcementId" value={announcementId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Pending label="Publish & notify" pendingLabel="Publishing…" />
      <p className="text-sm text-ink-soft">
        Sends a notification to {audienceLabel} and shows it in their portal.
      </p>
    </form>
  );
}

export function UnpublishAnnouncementForm({
  announcementId,
}: {
  announcementId: string;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    unpublishAnnouncementAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="announcementId" value={announcementId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Pending label="Withdraw" pendingLabel="Withdrawing…" variant="secondary" />
      <p className="text-sm text-ink-soft">
        Removes it from families&rsquo; portals. Notifications already sent are
        not recalled.
      </p>
    </form>
  );
}

export function DeleteAnnouncementForm({
  announcementId,
  title,
}: {
  announcementId: string;
  title: string;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    deleteAnnouncementAction,
    {},
  );
  const [confirm, setConfirm] = useState("");
  const matches = confirm.trim().toLowerCase() === title.trim().toLowerCase();

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="announcementId" value={announcementId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <label
        htmlFor={`confirm-${announcementId}`}
        className="block text-sm font-bold text-ink"
      >
        Type &ldquo;{title}&rdquo; to confirm
      </label>
      <input
        id={`confirm-${announcementId}`}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        autoComplete="off"
        className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-danger focus:outline-none"
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={!matches}
        className="border-danger/40 text-danger hover:border-danger hover:text-danger"
      >
        Delete announcement
      </Button>
    </form>
  );
}
