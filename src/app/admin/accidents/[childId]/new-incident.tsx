"use client";

import { useState } from "react";

import { Button } from "@/components/ui/form";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

import { IncidentForm } from "./incident-form";

/**
 * The blank form for a new accident.
 *
 * Open from the start on a day with nothing recorded — a teacher reaching this
 * screen has come to write something, and an extra tap between her and the
 * first field serves nobody. Once something is recorded it collapses, so the
 * day reads as a record rather than as a form.
 *
 * The `key` bump is what clears the form after a save: the signature lives
 * inside a canvas, and `form.reset()` cannot reach it. Remounting can.
 */
export function NewIncident({
  t,
  reportId,
  startOpen,
}: {
  t: Dictionary["admin"]["accidents"];
  reportId: string;
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [instance, setInstance] = useState(0);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {t.addAnother}
      </Button>
    );
  }

  return (
    <IncidentForm
      key={instance}
      t={t}
      reportId={reportId}
      onRecorded={() => setInstance((n) => n + 1)}
    />
  );
}
