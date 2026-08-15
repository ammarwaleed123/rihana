"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import { SignaturePad } from "@/components/ui/signature-pad";
import {
  signAccidentAction,
  type SignAccidentState,
} from "@/lib/portal/accident-actions";

/**
 * A guardian signs one accident record.
 *
 * Per incident, not per day: signing for the morning does not stand for an
 * afternoon they have not yet seen. Once a teacher corrects a record the
 * signature no longer describes what is on the screen, so the box comes back
 * and the parent is asked again rather than the app implying they agreed to a
 * version they never read.
 */
export function SignIncident({
  incidentId,
  signedAt,
  t,
}: {
  incidentId: string;
  /** Already signed, and not overtaken by a correction. */
  signedAt: string | null;
  t: {
    signature: string;
    signatureHint: string;
    signatureEmpty: string;
    signatureClear: string;
    sign: string;
    signing: string;
    signed: string;
  };
}) {
  const [state, act] = useActionState<SignAccidentState, FormData>(
    signAccidentAction,
    {},
  );
  const [hasInk, setHasInk] = useState(false);
  const router = useRouter();

  const done = state.done && state.incidentId === incidentId;

  // Bring the server's view back down so the signature the parent just drew is
  // rendered from the record rather than from a hopeful client-side guess.
  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  if (signedAt && !state.error) {
    return <Alert tone="success">{signedAt}</Alert>;
  }

  if (done) {
    return <Alert tone="success">{t.sign}</Alert>;
  }

  return (
    <form action={act} className="space-y-3">
      <input type="hidden" name="incidentId" value={incidentId} />

      {state.error && state.incidentId === incidentId ? (
        <Alert tone="error">{state.error}</Alert>
      ) : null}

      <SignaturePad
        name="signature"
        label={t.signature}
        hint={t.signatureHint}
        emptyLabel={t.signatureEmpty}
        clearLabel={t.signatureClear}
        onChange={setHasInk}
      />

      <Submit label={t.sign} busy={t.signing} disabled={!hasInk} />
    </form>
  );
}

function Submit({
  label,
  busy,
  disabled,
}: {
  label: string;
  busy: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full">
      {pending ? busy : label}
    </Button>
  );
}
