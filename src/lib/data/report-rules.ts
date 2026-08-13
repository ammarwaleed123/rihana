/**
 * When is a daily report finished?
 *
 * The nursery's rule is that a report cannot be sent home half-filled — every
 * section must be completed first. That rule lives here as a pure function so it
 * can be unit-tested without a database, and so the teacher's screen and the
 * publish action cannot drift apart: the form shows exactly what `missingFields`
 * returns, and the action refuses on exactly the same list.
 *
 * No imports from the data layer. Give it a shape, get back what is missing.
 */

/** A field key the interface can translate and point at. */
export type MissingField =
  | "arrivalTime"
  | "playAreas"
  | "quranMemorised"
  | "quranRevision"
  | "littleMuslim"
  | "mealBreakfast"
  | "mealSnack"
  | "mealLunch"
  | "mealBreakfastDescription"
  | "mealSnackDescription"
  | "mealLunchDescription"
  | "nap"
  | "toilet"
  | "teacherComments";

export type MealAmountValue = "ALL" | "SOME" | "NOT_HUNGRY";

export type ReportShape = {
  arrivalTime: string | null;
  playAreas: readonly string[];
  quranMemorised: string | null;
  quranRevision: string | null;
  littleMuslim: string | null;
  meals: ReadonlyArray<{
    meal: "BREAKFAST" | "SNACK" | "LUNCH";
    amount: MealAmountValue | null;
    description: string | null;
  }>;
  napNone: boolean;
  napFrom: string | null;
  napUntil: string | null;
  toiletNothingToRecord: boolean;
  toiletEntryCount: number;
  teacherComments: string | null;
};

/** "08:15" — 24-hour, zero-padded. Anything else is not a time we accept. */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string | null | undefined): boolean {
  return typeof value === "string" && TIME.test(value);
}

function blank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Everything still standing between this report and going home.
 *
 * Order matters: it is the order of the paper form, so a teacher reading the
 * list works down the page rather than hunting.
 */
export function missingFields(report: ReportShape): MissingField[] {
  const missing: MissingField[] = [];

  if (!isValidTime(report.arrivalTime)) missing.push("arrivalTime");
  if (report.playAreas.length === 0) missing.push("playAreas");

  if (blank(report.quranMemorised)) missing.push("quranMemorised");
  if (blank(report.quranRevision)) missing.push("quranRevision");
  if (blank(report.littleMuslim)) missing.push("littleMuslim");

  for (const meal of ["BREAKFAST", "SNACK", "LUNCH"] as const) {
    const row = report.meals.find((m) => m.meal === meal);
    const key = meal === "BREAKFAST" ? "Breakfast" : meal === "SNACK" ? "Snack" : "Lunch";

    if (!row || !row.amount) {
      missing.push(`meal${key}` as MissingField);
      continue;
    }

    /*
     * "I ate" is required — but not when the child was not hungry.
     *
     * The nursery asked for every field to be mandatory. Taken literally that
     * makes the form impossible to finish on a day a child ate nothing, since
     * there is nothing to write in the column. So the description is required
     * for ALL and SOME, and skipped for NOT_HUNGRY, which is the only reading
     * under which the rule can actually be satisfied.
     */
    if (row.amount !== "NOT_HUNGRY" && blank(row.description)) {
      missing.push(`meal${key}Description` as MissingField);
    }
  }

  /*
   * A child who stayed awake still has a complete report. Without this escape
   * the required nap times could never be filled on a no-nap day — the same
   * reason `toiletNothingToRecord` exists for a toilet-trained child.
   */
  if (!report.napNone) {
    if (!isValidTime(report.napFrom) || !isValidTime(report.napUntil)) {
      missing.push("nap");
    }
  }

  if (!report.toiletNothingToRecord && report.toiletEntryCount === 0) {
    missing.push("toilet");
  }

  if (blank(report.teacherComments)) missing.push("teacherComments");

  return missing;
}

export function isComplete(report: ReportShape): boolean {
  return missingFields(report).length === 0;
}

/** The paper has five lines. More would not fit the form staff know. */
export const MAX_TOILET_ENTRIES = 5;
