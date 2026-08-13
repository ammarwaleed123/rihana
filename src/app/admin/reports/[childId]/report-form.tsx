"use client";

import { useActionState, useState } from "react";

import { Alert, Button, Input } from "@/components/ui/form";
import { Card, SectionTitle } from "@/components/ui/shell";
import {
  markAbsentAction,
  publishReportAction,
  saveReportAction,
  type ReportState,
} from "@/lib/admin/report-actions";
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
  const [saveState, save] = useActionState<ReportState, FormData>(
    saveReportAction,
    {},
  );
  const [publishState, publish] = useActionState<ReportState, FormData>(
    publishReportAction,
    {},
  );
  const [absentState, absent] = useActionState<ReportState, FormData>(
    markAbsentAction,
    {},
  );

  const [noNap, setNoNap] = useState(report.napNone);
  const [nothingToRecord, setNothingToRecord] = useState(
    report.toiletNothingToRecord,
  );

  const closed = report.status === "ABSENT";
  const state = publishState.error || publishState.success || publishState.missing
    ? publishState
    : absentState.error || absentState.success
      ? absentState
      : saveState;

  /*
   * `initialMissing` is computed on the server render. After a successful save
   * or publish it is stale, and showing it would tell a teacher she still has to
   * fill in fields she just filled — right after telling her the report went
   * home. A success clears it; the revalidated page supplies a fresh list.
   */
  const missing = state.success
    ? []
    : (publishState.missing ?? initialMissing);

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
    <form action={save} className="space-y-6 pb-24">
      <input type="hidden" name="reportId" value={report.id} />

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
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border-2 border-ink/10 p-3"
                >
                  <div>
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
                      className="w-32"
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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
          <Button type="submit" variant="secondary">
            {t.save}
          </Button>

          <Button type="submit" formAction={publish}>
            {report.status === "PUBLISHED" ? t.resend : t.markFinished}
          </Button>

          {report.status === "DRAFT" ? (
            <Button
              type="submit"
              variant="ghost"
              formAction={absent}
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
