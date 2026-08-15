/**
 * Which fields did this teacher actually change?
 *
 * Two teachers fill one report at the same time — the Qur'an teacher does her
 * section, someone else records meals — so a save must apply only what was
 * touched and stay silent about the rest. Otherwise whoever saves last
 * overwrites the other's work with their own, older picture of the day.
 *
 * That question used to be answered in the browser: an onChange handler
 * collected field names into a hidden input. It was wrong in a way that only
 * showed up on a real phone. **The handler does not exist until React has
 * hydrated**, and a teacher starts filling the form the moment it appears — so
 * whatever she typed in the first second was never marked as changed, was never
 * sent, and vanished on save. Which field disappeared depended entirely on
 * which one she happened to touch first, which is why it looked random.
 *
 * So the comparison moved here, and to the server. The form carries a snapshot
 * of the values it was rendered with; the action compares the submission
 * against that snapshot. No listener, no hydration, no timing — and it works
 * with JavaScript switched off, where the old mechanism sent an empty list and
 * silently fell back to overwriting everything.
 *
 * Pure, and no imports from the data layer, so both sides can use it and the
 * comparison can be tested without a browser or a database.
 */

export type MealName = "BREAKFAST" | "SNACK" | "LUNCH";

export const BASELINE_MEALS: readonly MealName[] = ["BREAKFAST", "SNACK", "LUNCH"];

export type ToiletLine = {
  time: string;
  wet: boolean;
  bm: boolean;
  accident: boolean;
};

export type ReportBaseline = {
  arrivalTime: string;
  playAreas: string[];
  alsoEnjoyed: string;
  quranMemorised: string;
  quranRevision: string;
  littleMuslim: string;
  meals: Array<{ meal: MealName; amount: string; description: string }>;
  napNone: boolean;
  napFrom: string;
  napUntil: string;
  toiletNothingToRecord: boolean;
  toiletEntries: ToiletLine[];
  bringCleanClothes: boolean;
  bringDiapers: boolean;
  bringOther: string;
  teacherComments: string;
};

/** The shape the form renders from, loosened so either side can pass its own. */
type ReportLike = {
  arrivalTime?: string | null;
  playAreas?: readonly string[];
  alsoEnjoyed?: string | null;
  quranMemorised?: string | null;
  quranRevision?: string | null;
  littleMuslim?: string | null;
  meals?: ReadonlyArray<{
    meal: MealName;
    amount?: string | null;
    description?: string | null;
  }>;
  napNone?: boolean;
  napFrom?: string | null;
  napUntil?: string | null;
  toiletNothingToRecord?: boolean;
  toiletEntries?: ReadonlyArray<Partial<ToiletLine>>;
  bringCleanClothes?: boolean;
  bringDiapers?: boolean;
  bringOther?: string | null;
  teacherComments?: string | null;
};

const text = (value: string | null | undefined): string => (value ?? "").trim();

/** Snapshot the values a report screen is about to be rendered with. */
export function baselineFrom(report: ReportLike): ReportBaseline {
  return {
    arrivalTime: text(report.arrivalTime),
    playAreas: [...(report.playAreas ?? [])].sort(),
    alsoEnjoyed: text(report.alsoEnjoyed),
    quranMemorised: text(report.quranMemorised),
    quranRevision: text(report.quranRevision),
    littleMuslim: text(report.littleMuslim),
    meals: BASELINE_MEALS.map((meal) => {
      const row = report.meals?.find((m) => m.meal === meal);
      return {
        meal,
        amount: text(row?.amount),
        description: text(row?.description),
      };
    }),
    napNone: Boolean(report.napNone),
    napFrom: text(report.napFrom),
    napUntil: text(report.napUntil),
    toiletNothingToRecord: Boolean(report.toiletNothingToRecord),
    toiletEntries: (report.toiletEntries ?? []).map((entry) => ({
      time: text(entry.time),
      wet: Boolean(entry.wet),
      bm: Boolean(entry.bm),
      accident: Boolean(entry.accident),
    })),
    bringCleanClothes: Boolean(report.bringCleanClothes),
    bringDiapers: Boolean(report.bringDiapers),
    bringOther: text(report.bringOther),
    teacherComments: text(report.teacherComments),
  };
}

/**
 * The snapshot a submission represents.
 *
 * Used on both sides of the save: the action diffs against it, and it becomes
 * the form's new baseline afterwards. Built from what was SUBMITTED rather than
 * from what is now in the database — deliberately. The stored row may also hold
 * another teacher's edits, and pinning this form's baseline to those would make
 * the next save look like a change back to what is on this screen, quietly
 * undoing her work. The baseline has to describe what this teacher is looking
 * at, which is what she just sent.
 */
export function baselineFromInput(input: {
  arrivalTime: string;
  playAreas: readonly string[];
  alsoEnjoyed: string;
  quranMemorised: string;
  quranRevision: string;
  littleMuslim: string;
  meals: ReadonlyArray<{ meal: MealName; amount: string | null; description: string }>;
  napNone: boolean;
  napFrom: string;
  napUntil: string;
  toiletNothingToRecord: boolean;
  toiletEntries: ReadonlyArray<ToiletLine>;
  bringCleanClothes: boolean;
  bringDiapers: boolean;
  bringOther: string;
  teacherComments: string;
}): ReportBaseline {
  return baselineFrom({
    ...input,
    meals: input.meals.map((m) => ({
      meal: m.meal,
      amount: m.amount ?? "",
      description: m.description,
    })),
  });
}

/**
 * Read a baseline back off the wire.
 *
 * The snapshot travels through a hidden field, so it is client-supplied like
 * everything else in a form. It decides only which columns to write, never who
 * may write them — a tampered snapshot can claim more changed than there was,
 * which is exactly what typing in the fields would do anyway. Anything
 * unreadable returns null and the caller falls back to writing the lot, which
 * is the behaviour this replaced.
 */
export function parseBaseline(raw: string | null | undefined): ReportBaseline | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    // An array is an object and would sail through into an all-empty baseline,
    // which reads as "every field changed" — the fallback, but arrived at by
    // accident rather than by decision. A snapshot is a plain object or nothing.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return baselineFrom(parsed as ReportLike);
  } catch {
    return null;
  }
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

function sameLines(a: readonly ToiletLine[], b: readonly ToiletLine[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((line, index) => {
    const other = b[index]!;
    return (
      line.time === other.time &&
      line.wet === other.wet &&
      line.bm === other.bm &&
      line.accident === other.accident
    );
  });
}

/**
 * The field keys whose values differ between what was rendered and what came
 * back. Key names match the ones the save path checks.
 */
export function changedFieldsBetween(
  before: ReportBaseline,
  after: ReportBaseline,
): Set<string> {
  const changed = new Set<string>();
  const mark = (field: string, differs: boolean) => {
    if (differs) changed.add(field);
  };

  mark("arrivalTime", before.arrivalTime !== after.arrivalTime);
  mark("playAreas", !sameList(before.playAreas, after.playAreas));
  mark("alsoEnjoyed", before.alsoEnjoyed !== after.alsoEnjoyed);
  mark("quranMemorised", before.quranMemorised !== after.quranMemorised);
  mark("quranRevision", before.quranRevision !== after.quranRevision);
  mark("littleMuslim", before.littleMuslim !== after.littleMuslim);

  for (const meal of BASELINE_MEALS) {
    const was = before.meals.find((m) => m.meal === meal);
    const now = after.meals.find((m) => m.meal === meal);
    mark(`meal_${meal}_amount`, was?.amount !== now?.amount);
    mark(`meal_${meal}_description`, was?.description !== now?.description);
  }

  mark("napNone", before.napNone !== after.napNone);
  mark("napFrom", before.napFrom !== after.napFrom);
  mark("napUntil", before.napUntil !== after.napUntil);

  mark(
    "toiletNothingToRecord",
    before.toiletNothingToRecord !== after.toiletNothingToRecord,
  );
  mark("toiletEntries", !sameLines(before.toiletEntries, after.toiletEntries));

  mark("bringCleanClothes", before.bringCleanClothes !== after.bringCleanClothes);
  mark("bringDiapers", before.bringDiapers !== after.bringDiapers);
  mark("bringOther", before.bringOther !== after.bringOther);
  mark("teacherComments", before.teacherComments !== after.teacherComments);

  return changed;
}
