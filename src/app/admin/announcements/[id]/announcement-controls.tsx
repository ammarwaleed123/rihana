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
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill } from "@/lib/i18n/plural";

type T = Dictionary["admin"]["announcementForm"];

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
  t,
}: {
  announcementId: string;
  audienceLabel: string;
  t: T;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    publishAnnouncementAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="announcementId" value={announcementId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Pending label={t.publishAndNotify} pendingLabel={t.publishing} />
      <p className="text-sm text-ink-soft">
        {fill(t.publishNote, { audience: audienceLabel })}
      </p>
    </form>
  );
}

export function UnpublishAnnouncementForm({
  announcementId,
  t,
}: {
  announcementId: string;
  t: T;
}) {
  const [state, action] = useActionState<AnnouncementState, FormData>(
    unpublishAnnouncementAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="announcementId" value={announcementId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Pending
        label={t.withdraw}
        pendingLabel={t.withdrawing}
        variant="secondary"
      />
      <p className="text-sm text-ink-soft">{t.withdrawNote}</p>
    </form>
  );
}

export function DeleteAnnouncementForm({
  announcementId,
  title,
  t,
}: {
  announcementId: string;
  title: string;
  t: T;
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
        dir="auto"
        className="block text-sm font-bold text-ink"
      >
        {fill(t.confirmType, { title })}
      </label>
      <input
        id={`confirm-${announcementId}`}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        autoComplete="off"
        dir="auto"
        className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-danger focus:outline-none"
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={!matches}
        className="border-danger/40 text-danger hover:border-danger hover:text-danger"
      >
        {t.deleteAnnouncement}
      </Button>
    </form>
  );
}
