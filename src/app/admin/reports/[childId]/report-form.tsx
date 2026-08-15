"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Input } from "@/components/ui/form";
import { Card, SectionTitle } from "@/components/ui/shell";
import { reportAction, type ReportState } from "@/lib/admin/report-actions";
import { baselineFrom } from "@/lib/data/report-baseline";
import type { MissingField } from "@/lib/data/report-rules";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill } from "@/lib/i18n/plural";

type T = Dictionary["admin"]["reports"];

const PLAY_AREAS = [
  "BLOCKS",
  "DRAMATIC_PLAY",
  "ART",
  "LIBRARY",
  "DISCOVERY",
  "MOVEMENT",
  "COOKING",
] as const;

const MEALS = ["BREAKFAST", "SNACK", "LUNCH"] as const;
const AMOUNTS = ["ALL", "SOME", "NOT_HUNGRY"] as const;
const TOILET_ROWS = 5;

type ReportView = {
  id: string;
  status: "DRAFT" | "ABSENT" | "PUBLISHED";
  arrivalTime: string;
  playAreas: readonly string[];
  alsoEnjoyed: string;
  quranMemorised: string;
  quranRevision: string;
  littleMuslim: string;
  napNone: boolean;
  napFrom: string;
  napUntil: string;
  toiletNothingToRecord: boolean;
  toiletEntries: Array<{ time: string; wet: boolean; bm: boolean; accident: boolean }>;
  bringCleanClothes: boolean;
  bringDiapers: boolean;
  bringOther: string;
  teacherComments: string;
  meals: Array<{
    meal: "BREAKFAST" | "SNACK" | "LUNCH";
    amount: "ALL" | "SOME" | "NOT_HUNGRY" | null;
    description: string;
  }>;
};

function areaLabel(t: T, area: (typeof PLAY_AREAS)[number]): string {
  switch (area) {
    case "BLOCKS":
      return t.areaBlocks;
    case "DRAMATIC_PLAY":
      return t.areaDramaticPlay;
    case "ART":
      return t.areaArt;
    case "LIBRARY":
      return t.areaLibrary;
    case "DISCOVERY":
      return t.areaDiscovery;
    case "MOVEMENT":
      return t.areaMovement;
    case "COOKING":
      return t.areaCooking;
  }
}

function mealLabel(t: T, meal: (typeof MEALS)[number]): string {
  return meal === "BREAKFAST"
    ? t.mealBreakfast
    : meal === "SNACK"
      ? t.mealSnack
      : t.mealLunch;
}

function amountLabel(t: T, amount: (typeof AMOUNTS)[number]): string {
  return amount === "ALL"
    ? t.amountAll
    : amount === "SOME"
      ? t.amountSome
      : t.amountNotHungry;
}

/** Every outstanding field, named. "Something is missing" is not an instruction. */
function missingLabel(t: T, field: MissingField): string {
  const map: Record<MissingField, string> = {
    arrivalTime: t.missingArrivalTime,
    playAreas: t.missingPlayAreas,
    quranMemorised: t.missingQuranMemorised,
    quranRevision: t.missingQuranRevision,
    littleMuslim: t.missingLittleMuslim,
    mealBreakfast: t.missingMealBreakfast,
    mealSnack: t.missingMealSnack,
    mealLunch: t.missingMealLunch,
    mealBreakfastDescription: t.missingMealBreakfastDescription,
    mealSnackDescription: t.missingMealSnackDescription,
    mealLunchDescription: t.missingMealLunchDescription,
    nap: t.missingNap,
    toilet: t.missingToilet,
    teacherComments: t.missingTeacherComments,
  };
  return map[field];
}

/**
 * Write a submission back into the form it came from.
 *
 * Undoes React's post-action reset. Reading from the FormData that was actually
 * sent — rather than from a snapshot taken earlier — means what reappears is
 * exactly what the server was given, including anything typed in the moments
 * before the button was pressed.
 *
 * An unticked box is simply absent from FormData, which is why every checkbox
 * is decided by looking for its own value rather than by reading a field that
 * may not be there.
 */
function restoreInto(form: HTMLFormElement, data: FormData) {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      if (!element.name || element.type === "hidden") continue;

      if (element.type === "checkbox") {
        // `playAreas` sends many values under one name; a plain tick box sends
        // "on". Both are answered by asking whether this box's value was sent.
        element.checked = data.getAll(element.name).includes(element.value);
      } else if (element.type === "radio") {
        element.checked = data.get(element.name) === element.value;
      } else {
        element.value = String(data.get(element.name) ?? "");
      }
    } else if (element instanceof HTMLTextAreaElement && element.name) {
      element.value = String(data.get(element.name) ?? "");
    }
  }
}

function CheckRow({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
      />
      <span className="text-base text-ink">
        {label}
        {hint ? (
          <span className="ms-1 text-sm text-ink-faint">({hint})</span>
        ) : null}
      </span>
    </label>
  );
}

export function ReportForm({
  report,
  initialMissing,
  childName,
  t,
}: {
  report: ReportView;
  initialMissing: MissingField[];
  childName: string;
  t: T;
}) {
  const [state, submit] = useActionState<ReportState, FormData>(reportAction, {});

  const router = useRouter();

  /*
   * Which fields this teacher changed is decided on the server, by comparing the
   * submission against `baseline` below — not by a listener here.
   *
   * It was a listener once, and it was wrong on exactly the phones this is for:
   * an onChange handler does not exist until React has hydrated, and a teacher
   * starts filling the form the moment it appears. Anything entered in that
   * first second was never marked, never sent, and silently dropped on save —
   * the field that vanished being whichever one she touched first.
   */
  const formRef = useRef<HTMLFormElement>(null);

  /*
   * What was actually submitted, so it can be put back if it is ever lost.
   *
   * React resets an uncontrolled form once its action completes — every field
   * snaps back to the value it was rendered with, which on a report being
   * filled in for the first time is empty. The save had worked; the screen
   * wiped itself, and a teacher who had just typed the arrival time watched it
   * vanish and reasonably concluded nothing had been stored.
   *
   * Cancelling the reset (see `onReset` on the form) is enough on its own —
   * measured. This stays as a second layer because the failure is invisible
   * when it happens and the owner has now hit it twice: if a future React ever
   * resets without a cancelable event, this puts the values straight back. It
   * runs on every save, writing exactly what the server received, so it cannot
   * quietly rot into code that no longer works.
   */
  const submitted = useRef<FormData | null>(null);
  const baselineField = useRef<HTMLInputElement>(null);

  /**
   * Is there unsaved typing on screen?
   *
   * Read from the DOM rather than from state: every control carries the value
   * the server rendered as its `defaultValue`/`defaultChecked`, so the browser
   * has kept the comparison for us since before any JavaScript ran.
   */
  function hasUnsavedChanges(): boolean {
    const form = formRef.current;
    if (!form) return false;

    for (const element of Array.from(form.elements)) {
      if (element instanceof HTMLInputElement) {
        if (element.type === "hidden") continue;
        if (element.type === "checkbox" || element.type === "radio") {
          if (element.checked !== element.defaultChecked) return true;
        } else if (element.value !== element.defaultValue) {
          return true;
        }
      } else if (element instanceof HTMLTextAreaElement) {
        if (element.value !== element.defaultValue) return true;
      }
    }
    return false;
  }

  /*
   * Re-read the report when the teacher comes back to the app.
   *
   * They switch away constantly — to the camera, to a child who needs them — and
   * come back to a screen rendered an hour ago. Refreshing on return means they
   * see what another teacher has since saved, rather than re-typing it.
   *
   * Skipped while there are unsaved changes: pulling fresh data underneath
   * someone mid-sentence would be worse than showing them something slightly old.
   */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (hasUnsavedChanges()) return;
      router.refresh();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const [noNap, setNoNap] = useState(report.napNone);
  const [nothingToRecord, setNothingToRecord] = useState(
    report.toiletNothingToRecord,
  );

  const closed = report.status === "ABSENT";

  /*
   * `initialMissing` is computed on the server render. After a successful save
   * or publish it is stale, and showing it would tell a teacher she still has to
   * fill in fields she just filled — right after telling her the report went
   * home. A success clears it; the revalidated page supplies a fresh list.
   */
  const missing = state.missing ?? (state.success ? [] : initialMissing);

  /*
   * Put the teacher's own work back on the screen after the save, and move the
   * baseline forward to match.
   *
   * Deliberately without `router.refresh()`. Refreshing did update the
   * baseline, but it also re-ran React's reconciliation across every control —
   * and that put a tick back into a play area the teacher had just cleared, so
   * her next save re-sent it and the box she had unticked came back. The server
   * hands the new baseline back instead, which needs no re-render at all.
   *
   * Another teacher's changes still arrive: the visibility handler above
   * refreshes whenever she returns to the app with nothing unsaved.
   */
  useEffect(() => {
    if (!state.success) return;

    const form = formRef.current;
    const data = submitted.current;
    if (form && data) restoreInto(form, data);

    if (baselineField.current && state.baseline) {
      baselineField.current.value = state.baseline;
    }
  }, [state]);

  const successText =
    state.success === "saved"
      ? t.saved
      : state.success === "sentHome"
        ? t.sentHome
        : state.success === "resent"
          ? t.resent
          : state.success === "markedAbsent"
            ? t.markedAbsent
            : null;

  const mealOf = (meal: (typeof MEALS)[number]) =>
    report.meals.find((m) => m.meal === meal);

  if (closed) {
    return state.error ? <Alert tone="error">{state.error}</Alert> : null;
  }

  return (
    <form
      ref={formRef}
      /*
       * Wrapped rather than passing `submit` directly, only to keep a copy of
       * what went. With JavaScript off this never runs — the browser posts the
       * form itself — so progressive enhancement is untouched.
       */
      /*
       * `action={submit}` directly, never wrapped in a closure.
       *
       * Wrapping it does work with JavaScript on, and quietly breaks the form
       * without: Next can only render the fallback form action when the prop is
       * the action itself, so an inline arrow leaves a form that posts nowhere.
       * The copy for the fallback restore is taken in `onSubmit` instead, which
       * simply never runs when there is no JavaScript to run it.
       */
      action={submit}
      onSubmit={(event) => {
        submitted.current = new FormData(event.currentTarget);
      }}
      /*
       * Refuse the reset React performs after a form action completes.
       *
       * That reset is right for a form you submit and walk away from. This one
       * is an editing surface a teacher keeps open all day, and resetting it
       * put every field back to the value the page was opened with — so the
       * arrival time she had just typed vanished in front of her while the save
       * had in fact succeeded.
       *
       * `reset` is a cancelable event, so this stops it at source rather than
       * putting the values back afterwards, which was a race: it worked on the
       * first save and lost to the reset on the second.
       */
      onReset={(event) => event.preventDefault()}
      className="space-y-6 pb-24"
    >
      <input type="hidden" name="reportId" value={report.id} />
      {/*
       * The values this form was rendered with. The server diffs the submission
       * against these to decide what to write, so a teacher only ever overwrites
       * what she actually changed — and it works before hydration, and with
       * JavaScript off, neither of which was true of the handler this replaced.
       */}
      <input
        type="hidden"
        name="baseline"
        ref={baselineField}
        defaultValue={JSON.stringify(baselineFrom(report))}
      />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {successText ? <Alert tone="success">{successText}</Alert> : null}

      {missing.length > 0 ? (
        <Alert tone="info">
          <span className="block font-bold">{t.stillMissing}</span>
          <ul className="mt-1 list-inside list-disc font-normal">
            {missing.map((field) => (
              <li key={field}>{missingLabel(t, field)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Card>
        <label htmlFor="arrivalTime" className="mb-1.5 block text-sm font-bold">
          {t.arrivalTime}
        </label>
        <Input
          id="arrivalTime"
          name="arrivalTime"
          type="time"
          defaultValue={report.arrivalTime}
          dir="ltr"
          className="max-w-40"
        />
        <p className="mt-1 text-sm text-ink-faint">{t.timeHint}</p>
      </Card>

      <Card>
        <SectionTitle>{t.playedIn}</SectionTitle>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {PLAY_AREAS.map((area) => (
            <label key={area} className="flex cursor-pointer items-center gap-3 py-1.5">
              <input
                type="checkbox"
                name="playAreas"
                value={area}
                defaultChecked={report.playAreas.includes(area)}
                className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
              />
              <span className="text-base text-ink">{areaLabel(t, area)}</span>
            </label>
          ))}
        </div>

        <label htmlFor="alsoEnjoyed" className="mb-1.5 mt-4 block text-sm font-bold">
          {t.alsoEnjoyed}
        </label>
        <Input id="alsoEnjoyed" name="alsoEnjoyed" defaultValue={report.alsoEnjoyed} />
      </Card>

      {/*
       * The Qur'an headings stay in Arabic in both interface languages: they are
       * the names of the subjects as the nursery teaches them, not phrases to be
       * translated. `dir="rtl"` so they read correctly inside the English layout.
       */}
      <Card>
        <div dir="rtl" className="text-start">
          <SectionTitle>{t.quran}</SectionTitle>
        </div>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quranMemorised" className="mb-1.5 block text-sm font-bold" dir="rtl">
              {t.quranMemorised}
            </label>
            <Input
              id="quranMemorised"
              name="quranMemorised"
              defaultValue={report.quranMemorised}
            />
          </div>
          <div>
            <label htmlFor="quranRevision" className="mb-1.5 block text-sm font-bold" dir="rtl">
              {t.quranRevision}
            </label>
            <Input
              id="quranRevision"
              name="quranRevision"
              defaultValue={report.quranRevision}
            />
          </div>
        </div>

        <label htmlFor="littleMuslim" className="mb-1.5 mt-4 block text-sm font-bold" dir="rtl">
          {t.littleMuslim}
        </label>
        <textarea
          id="littleMuslim"
          name="littleMuslim"
          dir="auto"
          rows={2}
          defaultValue={report.littleMuslim}
          className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none"
        />
      </Card>

      <Card>
        <SectionTitle>{t.ate}</SectionTitle>
        <div className="mt-2 space-y-4">
          {MEALS.map((meal) => {
            const row = mealOf(meal);
            return (
              <div key={meal} className="rounded-xl border-2 border-ink/10 p-3">
                <p className="mb-2 font-bold text-ink">{mealLabel(t, meal)}</p>
                <div className="flex flex-wrap gap-4">
                  {AMOUNTS.map((amount) => (
                    <label key={amount} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name={`meal_${meal}_amount`}
                        value={amount}
                        defaultChecked={row?.amount === amount}
                        className="size-5 accent-leaf"
                      />
                      <span className="text-base text-ink">{amountLabel(t, amount)}</span>
                    </label>
                  ))}
                </div>
                <label
                  htmlFor={`meal_${meal}_description`}
                  className="mb-1.5 mt-3 block text-sm font-bold"
                >
                  {t.iAte}
                </label>
                <Input
                  id={`meal_${meal}_description`}
                  name={`meal_${meal}_description`}
                  defaultValue={row?.description ?? ""}
                />
                <p className="mt-1 text-sm text-ink-faint">{t.iAteHint}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t.toilet}</SectionTitle>

        <div className="mt-2">
          <label className="flex cursor-pointer items-center gap-3 py-1.5">
            <input
              type="checkbox"
              name="toiletNothingToRecord"
              checked={nothingToRecord}
              onChange={(event) => setNothingToRecord(event.target.checked)}
              className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
            />
            <span className="text-base font-semibold text-ink">{t.toiletNothing}</span>
          </label>
        </div>

        {nothingToRecord ? null : (
          <div className="mt-3 space-y-3">
            {Array.from({ length: TOILET_ROWS }, (_, index) => {
              const entry = report.toiletEntries[index];
              return (
                <div
                  key={index}
                  className="rounded-xl border-2 border-ink/10 p-3"
                >
                  <div className="mb-2">
                    <label
                      htmlFor={`toilet_${index}_time`}
                      className="mb-1 block text-xs font-bold text-ink-soft"
                    >
                      {t.toiletTime}
                    </label>
                    <Input
                      id={`toilet_${index}_time`}
                      name={`toilet_${index}_time`}
                      type="time"
                      dir="ltr"
                      defaultValue={entry?.time ?? ""}
                      className="min-w-0 max-w-full"
                    />
                  </div>

                  <CheckRow
                    name={`toilet_${index}_wet`}
                    defaultChecked={entry?.wet}
                    label={t.toiletWet}
                    hint={t.toiletWetHint}
                  />
                  <CheckRow
                    name={`toilet_${index}_bm`}
                    defaultChecked={entry?.bm}
                    label={t.toiletBm}
                    hint={t.toiletBmHint}
                  />
                  <CheckRow
                    name={`toilet_${index}_accident`}
                    defaultChecked={entry?.accident}
                    label={t.toiletAccident}
                    hint={t.toiletAccidentHint}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>{t.nap}</SectionTitle>

        <label className="mt-2 flex cursor-pointer items-center gap-3 py-1.5">
          <input
            type="checkbox"
            name="napNone"
            checked={noNap}
            onChange={(event) => setNoNap(event.target.checked)}
            className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
          />
          <span className="text-base font-semibold text-ink">{t.napNone}</span>
        </label>

        {noNap ? null : (
          <div className="mt-3 flex flex-wrap gap-4">
            <div>
              <label htmlFor="napFrom" className="mb-1.5 block text-sm font-bold">
                {t.napFrom}
              </label>
              <Input
                id="napFrom"
                name="napFrom"
                type="time"
                dir="ltr"
                defaultValue={report.napFrom}
                className="w-36"
              />
            </div>
            <div>
              <label htmlFor="napUntil" className="mb-1.5 block text-sm font-bold">
                {t.napUntil}
              </label>
              <Input
                id="napUntil"
                name="napUntil"
                type="time"
                dir="ltr"
                defaultValue={report.napUntil}
                className="w-36"
              />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>{t.bring}</SectionTitle>
        <div className="mt-2">
          <CheckRow
            name="bringCleanClothes"
            defaultChecked={report.bringCleanClothes}
            label={t.bringCleanClothes}
          />
          <CheckRow
            name="bringDiapers"
            defaultChecked={report.bringDiapers}
            label={t.bringDiapers}
          />
        </div>
        <label htmlFor="bringOther" className="mb-1.5 mt-3 block text-sm font-bold">
          {t.bringOther}
        </label>
        <Input id="bringOther" name="bringOther" defaultValue={report.bringOther} />
      </Card>

      <Card>
        <label htmlFor="teacherComments" className="mb-1.5 block text-sm font-bold">
          {t.teacherComments}
        </label>
        <textarea
          id="teacherComments"
          name="teacherComments"
          dir="auto"
          rows={3}
          defaultValue={report.teacherComments}
          className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none"
        />
      </Card>

      {/*
       * The actions stay reachable without scrolling back up. A teacher fills
       * this in standing up, one-handed, and losing the Save button below a long
       * form is how work gets lost.
       */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-ink/10 bg-paper/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 sm:justify-end">
          <Button
            type="submit"
            name="intent"
            value="save"
            variant="secondary"
            className="px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base"
          >
            {t.save}
          </Button>

          <Button
            type="submit"
            name="intent"
            value="publish"
            className="px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base"
          >
            {report.status === "PUBLISHED" ? t.resend : t.markFinished}
          </Button>

          {report.status === "DRAFT" ? (
            <Button
              type="submit"
              variant="ghost"
              name="intent"
              value="absent"
              className="px-3 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base"
              onClick={(event) => {
                if (
                  !window.confirm(fill(t.markAbsentConfirm, { name: childName }))
                ) {
                  event.preventDefault();
                }
              }}
            >
              {t.markAbsent}
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
