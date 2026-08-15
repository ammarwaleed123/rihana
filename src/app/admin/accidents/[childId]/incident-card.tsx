"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import { Badge, Card, SectionTitle } from "@/components/ui/shell";
import {
  accidentAction,
  type AccidentState,
} from "@/lib/admin/accident-actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill } from "@/lib/i18n/plural";

import { IncidentForm } from "./incident-form";

type T = Dictionary["admin"]["accidents"];

export type IncidentView = {
  id: string;
  timeOfIncident: string;
  place: string;
  placeOther: string | null;
  figure: string;
  bodyParts: string[];
  nature: string[];
  natureOther: string | null;
  treatment: string[];
  treatmentOther: string | null;
  description: string;
  parentsNotified: boolean;
  doctorNotified: boolean;
  notificationTime: string | null;
  /** Pre-formatted on the server: the client has no locale of its own. */
  signedByName: string;
  signedAtLabel: string;
  correctedLabel: string | null;
  /** How the family stands on this version. */
  family: "signed" | "waiting" | "again";
  familySignedLabel: string | null;
  /*
   * Human-readable summaries, resolved and joined on the server.
   *
   * Joined there rather than here because "and" between list items is a
   * locale's business — `Intl.ListFormat` knows that English wants
   * "Knee, Hand and Foot" and Arabic wants "الركبة والقدم" — and this component
   * has no locale of its own.
   */
  placeLabel: string;
  bodyPartsText: string;
  natureText: string;
  treatmentText: string;
  notifiedText: string;
};

/**
 * One recorded accident, as staff see it.
 *
 * Read-only until someone asks to correct it. A record of an injury is not a
 * text box that happens to be pre-filled — opening it for editing should be a
 * decision, not the default state of the screen.
 */
export function IncidentCard({
  t,
  incident,
  canDelete,
}: {
  t: T;
  incident: IncidentView;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <IncidentForm
        t={t}
        incident={incident}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle>
          <span dir="ltr">{incident.timeOfIncident}</span> · {incident.placeLabel}
          {incident.place === "OTHER" && incident.placeOther
            ? ` — ${incident.placeOther}`
            : ""}
        </SectionTitle>

        {incident.family === "signed" ? (
          <Badge tone="green">{incident.familySignedLabel ?? ""}</Badge>
        ) : incident.family === "again" ? (
          <Badge tone="yellow">{t.awaitingAgain}</Badge>
        ) : (
          <Badge tone="neutral">{t.awaitingFamily}</Badge>
        )}
      </div>

      <dl className="mt-3 space-y-2 text-ink">
        <Row label={t.bodyParts} value={incident.bodyPartsText} />
        <Row label={t.nature} value={incident.natureText} />
        <Row label={t.treatment} value={incident.treatmentText} />
      </dl>

      <p className="mt-3 whitespace-pre-line text-ink" dir="auto">
        {incident.description}
      </p>

      {incident.parentsNotified || incident.doctorNotified ? (
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          {incident.notifiedText}
          {incident.notificationTime ? (
            <>
              {" · "}
              <span dir="ltr">{incident.notificationTime}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 border-t-2 border-ink/10 pt-3">
        <p className="text-sm font-semibold text-ink-soft">
          {fill(t.recordedBy, {
            name: incident.signedByName,
            time: incident.signedAtLabel,
          })}
        </p>
        {incident.correctedLabel ? (
          <p className="text-sm text-ink-faint">{incident.correctedLabel}</p>
        ) : null}

        {/*
         * The signature is served through the authorized image route like every
         * other private image, never as a direct storage URL. `unoptimized`
         * because that route answers with a 302 to a short-lived signed URL,
         * which the image optimizer cannot cache or re-fetch.
         */}
        <Image
          src={`/api/img/signature/incident/${incident.id}`}
          alt=""
          width={300}
          height={100}
          unoptimized
          className="mt-2 h-auto w-full max-w-[300px] rounded-lg border-2 border-ink/10 bg-white"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          {t.editThis}
        </Button>
        {canDelete ? <DeleteIncident t={t} incidentId={incident.id} /> : null}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="font-bold">{label}:</dt>
      <dd dir="auto">{value}</dd>
    </div>
  );
}

/**
 * Owner-only destruction.
 *
 * A teacher corrects; deleting the record of an injury — and the family's
 * signature with it — is a different act, so the confirmation names both
 * consequences rather than asking "are you sure".
 */
function DeleteIncident({ t, incidentId }: { t: T; incidentId: string }) {
  const [state, act] = useActionState<AccidentState, FormData>(
    accidentAction,
    {},
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success === "deleted") router.refresh();
  }, [state.success, router]);

  if (state.success === "deleted") {
    return <Alert tone="success">{t.deleted}</Alert>;
  }

  return (
    <form
      action={act}
      onSubmit={(event) => {
        if (!window.confirm(t.deleteConfirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="incidentId" value={incidentId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <DeleteButton label={t.deleteThis} />
    </form>
  );
}

function DeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      disabled={pending}
      className="text-danger hover:text-danger"
    >
      {label}
    </Button>
  );
}
