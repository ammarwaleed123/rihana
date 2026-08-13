"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import {
  acknowledgeReportAction,
  type AcknowledgeState,
} from "@/lib/portal/report-actions";
import { fill } from "@/lib/i18n/plural";

/**
 * "I have read this".
 *
 * A plain button, not a signature — the nursery only needs a signature on an
 * accident report. Once acknowledged it stays acknowledged and says when, so a
 * parent who reopens the report a week later can see they already confirmed it.
 */
export function AcknowledgeButton({
  reportId,
  acknowledgedAt,
  t,
}: {
  reportId: string;
  acknowledgedAt: string | null;
  t: { acknowledge: string; acknowledging: string; acknowledged: string };
}) {
  const [state, act] = useActionState<AcknowledgeState, FormData>(
    acknowledgeReportAction,
    {},
  );

  if (acknowledgedAt) {
    return <Alert tone="success">{fill(t.acknowledged, { date: acknowledgedAt })}</Alert>;
  }

  if (state.done) {
    return <Alert tone="success">{t.acknowledge}</Alert>;
  }

  return (
    <form action={act}>
      <input type="hidden" name="reportId" value={reportId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Submit label={t.acknowledge} busy={t.acknowledging} />
    </form>
  );
}

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? busy : label}
    </Button>
  );
}
