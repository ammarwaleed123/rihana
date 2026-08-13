"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Input } from "@/components/ui/form";
import { Card, SectionTitle } from "@/components/ui/shell";
import { reportAction, type ReportState } from "@/lib/admin/report-actions";
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
   * Which fields THIS teacher actually changed.
   *
   * A save sends only these. Without it every save is a full replacement of the
   * form as it looked when this page loaded — so a teacher recording lunch at
   * 14:05 would blank out the nap another teacher saved at 13:00, silently, with
   * no error. Two teachers filling one report is the normal case here, not an
   * edge case, and the form was the only thing over-sending: the data layer
   * already treats "not provided" as "leave alone".
   *
   * Kept in a ref and mirrored into a hidden input, so recording a keystroke
   * costs no re-render.
   */
  const changed = useRef<Set<string>>(new Set());
  const changedField = useRef<HTMLInputElement>(null);

  function markChanged(name: string) {
    if (!name) return;
    changed.current.add(name);
    if (changedField.current) {
      changedField.current.value = [...changed.current].join(",");
    }
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
      if (changed.current.size > 0) return;
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
  const missing = state.success ? [] : (state.missing ?? initialMissing);

  useEffect(() => {
    if (!state.success) return;
    changed.current.clear();
    if (changedField.current) changedField.current.value = "";
  }, [state.success]);

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
      action={submit}
      className="space-y-6 pb-24"
      onChange={(event) => {
        const target = event.target as unknown as { name?: string };
        const name = target.name ?? "";
        markChanged(name);
        // A nappy line and its checkboxes are stored together, so any of them
        // changing means the whole set is resubmitted.
        if (name.startsWith("toilet_")) markChanged("toiletEntries");
      }}
    >
      <input type="hidden" name="reportId" value={report.id} />
      <input type="hidden" name="changedFields" ref={changedField} defaultValue="" />

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
          className="w-full sm:max-w-44"
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
              onChange={(event) => {
                setNothingToRecord(event.target.checked);
                markChanged("toiletNothingToRecord");
                markChanged("toiletEntries");
              }}
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
                  <div className="mb-2 sm:max-w-44">
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
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
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
            onChange={(event) => {
              setNoNap(event.target.checked);
              markChanged("napNone");
              markChanged("napFrom");
              markChanged("napUntil");
            }}
            className="size-5 shrink-0 rounded border-2 border-ink/25 accent-leaf"
          />
          <span className="text-base font-semibold text-ink">{t.napNone}</span>
        </label>

        {noNap ? null : (
          <div className="mt-3 grid gap-4 sm:flex sm:flex-wrap">
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
                className="w-full sm:w-40"
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
                className="w-full sm:w-40"
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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
          <Button type="submit" name="intent" value="save" variant="secondary">
            {t.save}
          </Button>

          <Button type="submit" name="intent" value="publish">
            {report.status === "PUBLISHED" ? t.resend : t.markFinished}
          </Button>

          {report.status === "DRAFT" ? (
            <Button
              type="submit"
              variant="ghost"
              name="intent"
              value="absent"
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
