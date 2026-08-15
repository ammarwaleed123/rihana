"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { SignaturePad } from "@/components/ui/signature-pad";
import { Alert, Button, Input } from "@/components/ui/form";
import { Card, SectionTitle } from "@/components/ui/shell";
import {
  accidentAction,
  type AccidentState,
} from "@/lib/admin/accident-actions";
import type { IncidentMissingField } from "@/lib/data/accident-rules";
import {
  natureLabel,
  partLabel,
  placeLabel,
  treatmentLabel,
} from "@/lib/i18n/accident-labels";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import {
  ACCIDENT_PLACES,
  BODY_FIGURES,
  BODY_PARTS,
  INJURY_NATURES,
  INJURY_TREATMENTS,
} from "@/lib/validation";

type T = Dictionary["admin"]["accidents"];

/**
 * One accident, written or corrected.
 *
 * Unlike the daily report there is no partial save and no dirty-field tracking:
 * an accident is not filled in over a day by several people, it is written once
 * by whoever was there, in one sitting, and signed. So the whole form submits
 * and the server answers with what is still missing.
 *
 * The signature is what makes this different from every other form in the app,
 * and it is why this screen requires JavaScript where the daily report does
 * not. A submit button that could produce an unsigned record would be worse
 * than one that does not appear.
 */
export function IncidentForm({
  t,
  reportId,
  incident,
  onRecorded,
  onCancel,
}: {
  t: T;
  /** Set when recording a new accident on this day. */
  reportId?: string;
  /** Set when correcting one already recorded. */
  incident?: {
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
  };
  /** Called after a new record is stored, so the caller can offer another. */
  onRecorded?: () => void;
  /** Called to close a correction without saving. */
  onCancel?: () => void;
}) {
  const editing = incident !== undefined;
  const [state, act] = useActionState<AccidentState, FormData>(
    accidentAction,
    {},
  );
  const router = useRouter();

  const [place, setPlace] = useState(incident?.place ?? "");
  const [nature, setNature] = useState<string[]>(incident?.nature ?? []);
  const [treatment, setTreatment] = useState<string[]>(
    incident?.treatment ?? [],
  );
  const [called, setCalled] = useState({
    parents: incident?.parentsNotified ?? false,
    doctor: incident?.doctorNotified ?? false,
  });
  const [hasInk, setHasInk] = useState(false);

  const done = state.success === "recorded" || state.success === "corrected";

  /*
   * Pull the server's view of the day back down once the write lands, so the
   * new record appears in the list above without a full navigation. This is
   * `router.refresh` rather than `revalidatePath` in the action, deliberately:
   * revalidating from the server reset the action state AND left the stale
   * render on screen, which is how a teacher ended up being told nothing at all
   * while the save behind her succeeded.
   */
  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  if (state.success === "recorded") {
    return (
      <Card>
        <div className="space-y-3">
          <Alert tone="success">{t.recorded}</Alert>
          <Button type="button" variant="secondary" onClick={onRecorded}>
            {t.addAnother}
          </Button>
        </div>
      </Card>
    );
  }

  if (state.success === "corrected") {
    return (
      <Card>
        <div className="space-y-3">
          <Alert tone="success">{t.corrected}</Alert>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t.cancelEdit}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form action={act} className="space-y-4">
      <input type="hidden" name="intent" value={editing ? "correct" : "record"} />
      {editing ? (
        <input type="hidden" name="incidentId" value={incident.id} />
      ) : (
        <input type="hidden" name="reportId" value={reportId ?? ""} />
      )}

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {state.missing && state.missing.length > 0 ? (
        <Alert tone="error">
          <p>{t.stillMissing}</p>
          <ul className="mt-1 list-inside list-disc font-semibold">
            {state.missing.map((field) => (
              <li key={field}>{missingLabel(t, field)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Card>
        <label htmlFor="timeOfIncident" className="mb-1.5 block text-sm font-bold">
          {t.timeOfIncident}
        </label>
        <Input
          id="timeOfIncident"
          name="timeOfIncident"
          type="time"
          defaultValue={incident?.timeOfIncident ?? ""}
          dir="ltr"
        />
        <p className="mt-1 text-sm text-ink-faint">{t.timeHint}</p>
      </Card>

      <Card>
        <SectionTitle>{t.place}</SectionTitle>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {ACCIDENT_PLACES.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 py-1.5"
            >
              <input
                type="radio"
                name="place"
                value={value}
                checked={place === value}
                onChange={() => setPlace(value)}
                className="size-5 shrink-0 accent-leaf"
              />
              <span className="text-base text-ink">{placeLabel(t, value)}</span>
            </label>
          ))}
        </div>

        {place === "OTHER" ? (
          <div className="mt-3">
            <label htmlFor="placeOther" className="mb-1.5 block text-sm font-bold">
              {t.placeOtherLabel}
            </label>
            <Input
              id="placeOther"
              name="placeOther"
              defaultValue={incident?.placeOther ?? ""}
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t.figure}</SectionTitle>
        {/*
         * Boy and girl, as the paper has, because the printed form carries two
         * figures and staff mark the one that matches. It selects which drawing
         * the record shows — nothing about the child's record depends on it.
         */}
        <div className="mt-2 flex gap-3">
          {BODY_FIGURES.map((value) => (
            <label
              key={value}
              className="flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-ink/15 p-3 has-[:checked]:border-leaf has-[:checked]:bg-leaf-soft"
            >
              <ChildFigure kind={value} />
              <span className="flex items-center gap-2 text-base font-semibold text-ink">
                <input
                  type="radio"
                  name="figure"
                  value={value}
                  defaultChecked={incident?.figure === value}
                  className="size-5 accent-leaf"
                />
                {value === "BOY" ? t.figureBoy : t.figureGirl}
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t.bodyParts}</SectionTitle>
        <p className="mt-1 text-sm text-ink-faint">{t.bodyPartsHint}</p>
        {/*
         * Words, not a clickable diagram: on paper the teacher circles the word,
         * and a word is unambiguous where a tap near an elbow is not.
         */}
        <div className="mt-2 flex flex-wrap gap-2">
          {BODY_PARTS.map((value) => (
            <label
              key={value}
              className="cursor-pointer rounded-full border-2 border-ink/15 px-3 py-2 text-sm font-semibold text-ink transition-colors has-[:checked]:border-leaf has-[:checked]:bg-leaf-soft has-[:checked]:text-leaf-dark"
            >
              <input
                type="checkbox"
                name="bodyParts"
                value={value}
                defaultChecked={incident?.bodyParts.includes(value)}
                className="me-2 size-4 rounded accent-leaf"
              />
              {partLabel(t, value)}
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t.nature}</SectionTitle>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {INJURY_NATURES.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 py-1.5"
            >
              <input
                type="checkbox"
                name="nature"
                value={value}
                checked={nature.includes(value)}
                onChange={(event) =>
                  setNature(toggle(nature, value, event.target.checked))
                }
                className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
              />
              <span className="text-base text-ink">{natureLabel(t, value)}</span>
            </label>
          ))}
        </div>

        {nature.includes("OTHER") ? (
          <div className="mt-3">
            <label htmlFor="natureOther" className="mb-1.5 block text-sm font-bold">
              {t.natureOtherLabel}
            </label>
            <Input
              id="natureOther"
              name="natureOther"
              defaultValue={incident?.natureOther ?? ""}
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t.treatment}</SectionTitle>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {INJURY_TREATMENTS.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 py-1.5"
            >
              <input
                type="checkbox"
                name="treatment"
                value={value}
                checked={treatment.includes(value)}
                onChange={(event) =>
                  setTreatment(toggle(treatment, value, event.target.checked))
                }
                className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
              />
              <span className="text-base text-ink">
                {treatmentLabel(t, value)}
              </span>
            </label>
          ))}
        </div>

        {treatment.includes("OTHER") ? (
          <div className="mt-3">
            <label
              htmlFor="treatmentOther"
              className="mb-1.5 block text-sm font-bold"
            >
              {t.treatmentOtherLabel}
            </label>
            <Input
              id="treatmentOther"
              name="treatmentOther"
              defaultValue={incident?.treatmentOther ?? ""}
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t.whatHappened}</SectionTitle>
        <p className="mt-1 text-sm text-ink-faint">{t.whatHappenedHint}</p>
        <textarea
          id="description"
          name="description"
          rows={4}
          dir="auto"
          defaultValue={incident?.description ?? ""}
          className="mt-2 w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none"
        />
      </Card>

      <Card>
        <SectionTitle>{t.notified}</SectionTitle>
        <div className="mt-2 space-y-1">
          <label className="flex cursor-pointer items-center gap-3 py-1.5">
            <input
              type="checkbox"
              name="parentsNotified"
              checked={called.parents}
              onChange={(event) =>
                setCalled((c) => ({ ...c, parents: event.target.checked }))
              }
              className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
            />
            <span className="text-base text-ink">{t.parentsNotified}</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 py-1.5">
            <input
              type="checkbox"
              name="doctorNotified"
              checked={called.doctor}
              onChange={(event) =>
                setCalled((c) => ({ ...c, doctor: event.target.checked }))
              }
              className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
            />
            <span className="text-base text-ink">{t.doctorNotified}</span>
          </label>
        </div>

        {/*
         * Only asked for once somebody was actually called. Demanding a time on
         * a scrape that needed no phone call would make the form impossible to
         * finish honestly.
         */}
        {called.parents || called.doctor ? (
          <div className="mt-3">
            <label
              htmlFor="notificationTime"
              className="mb-1.5 block text-sm font-bold"
            >
              {t.notificationTime}
            </label>
            <Input
              id="notificationTime"
              name="notificationTime"
              type="time"
              defaultValue={incident?.notificationTime ?? ""}
              dir="ltr"
            />
            <p className="mt-1 text-sm text-ink-faint">{t.notificationHint}</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <SignaturePad
          name="signature"
          label={t.signature}
          hint={t.signatureHint}
          emptyLabel={t.signatureEmpty}
          clearLabel={t.signatureClear}
          onChange={setHasInk}
        />
      </Card>

      <div className="flex flex-wrap gap-3">
        <Submit
          label={editing ? t.correct : t.submit}
          busy={editing ? t.correctBusy : t.submitBusy}
          disabled={!hasInk}
        />
        {editing ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t.cancelEdit}
          </Button>
        ) : null}
      </div>
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
    <Button type="submit" disabled={pending || disabled}>
      {pending ? busy : label}
    </Button>
  );
}

function toggle(list: string[], value: string, on: boolean): string[] {
  return on ? [...list, value] : list.filter((v) => v !== value);
}

function missingLabel(t: T, field: IncidentMissingField): string {
  return {
    timeOfIncident: t.missingTimeOfIncident,
    place: t.missingPlace,
    placeOther: t.missingPlaceOther,
    figure: t.missingFigure,
    bodyParts: t.missingBodyParts,
    nature: t.missingNature,
    natureOther: t.missingNatureOther,
    treatment: t.missingTreatment,
    treatmentOther: t.missingTreatmentOther,
    description: t.missingDescription,
    notificationTime: t.missingNotificationTime,
    signature: t.missingSignature,
  }[field];
}

/**
 * The two figures from the paper form.
 *
 * Decorative — the label beside it carries the meaning, so it is aria-hidden
 * rather than given a duplicate accessible name.
 */
function ChildFigure({ kind }: { kind: "BOY" | "GIRL" }) {
  return (
    <svg
      aria-hidden
      width="44"
      height="64"
      viewBox="0 0 44 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-soft"
    >
      <circle cx="22" cy="11" r="8" />
      {kind === "BOY" ? (
        <path d="M22 19v18M10 26l12-5 12 5M15 37v18M29 37v18" />
      ) : (
        <path d="M22 19v14M10 26l12-5 12 5M13 45l9-12 9 12ZM17 45v10M27 45v10" />
      )}
    </svg>
  );
}
