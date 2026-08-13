import { describe, expect, it } from "vitest";

import {
  isComplete,
  isValidTime,
  missingFields,
  type ReportShape,
} from "@/lib/data/report-rules";

/**
 * A daily report cannot be sent home half-filled — that is the nursery's rule,
 * and this is where it lives. Two things make it worth testing hard:
 *
 * The teacher's screen and the publish action both read `missingFields`, so if
 * it is wrong they are wrong together and the disagreement never surfaces.
 *
 * And "everything is mandatory" is not literally satisfiable. A child who stayed
 * awake has no nap times; a toilet-trained child has nothing to log; a child who
 * was not hungry ate nothing worth describing. Each of those needs an escape, or
 * the form becomes impossible to finish on an ordinary day. Most of what follows
 * is about those three.
 */

const complete: ReportShape = {
  arrivalTime: "08:15",
  playAreas: ["BLOCKS"],
  quranMemorised: "Al-Fatiha 1-4",
  quranRevision: "Al-Ikhlas",
  littleMuslim: "Saying bismillah before eating",
  meals: [
    { meal: "BREAKFAST", amount: "ALL", description: "Cheese sandwich" },
    { meal: "SNACK", amount: "SOME", description: "Apple slices" },
    { meal: "LUNCH", amount: "ALL", description: "Rice and chicken" },
  ],
  napNone: false,
  napFrom: "12:30",
  napUntil: "14:00",
  toiletNothingToRecord: false,
  toiletEntryCount: 2,
  teacherComments: "A happy day.",
};

function without(patch: Partial<ReportShape>): ReportShape {
  return { ...complete, ...patch };
}

describe("isValidTime", () => {
  it("accepts 24-hour zero-padded times", () => {
    for (const value of ["00:00", "08:15", "12:30", "23:59"]) {
      expect(isValidTime(value)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["8:15", "24:00", "12:60", "noon", "", null, undefined]) {
      expect(isValidTime(value as string)).toBe(false);
    }
  });
});

describe("a complete report", () => {
  it("has nothing outstanding", () => {
    expect(missingFields(complete)).toEqual([]);
    expect(isComplete(complete)).toBe(true);
  });
});

describe("each required field blocks publishing", () => {
  it("arrival time", () => {
    expect(missingFields(without({ arrivalTime: null }))).toContain("arrivalTime");
  });

  it("arrival time that is not a real time", () => {
    expect(missingFields(without({ arrivalTime: "later" }))).toContain("arrivalTime");
  });

  it("at least one play area", () => {
    expect(missingFields(without({ playAreas: [] }))).toContain("playAreas");
  });

  it("the Quran fields", () => {
    expect(missingFields(without({ quranMemorised: null }))).toContain("quranMemorised");
    expect(missingFields(without({ quranRevision: "  " }))).toContain("quranRevision");
  });

  it("the little Muslim note", () => {
    expect(missingFields(without({ littleMuslim: null }))).toContain("littleMuslim");
  });

  it("the teacher's comments", () => {
    expect(missingFields(without({ teacherComments: "" }))).toContain("teacherComments");
  });
});

describe("meals", () => {
  it("blocks when a meal has no amount recorded", () => {
    const missing = missingFields(
      without({
        meals: [
          { meal: "BREAKFAST", amount: "ALL", description: "Toast" },
          { meal: "LUNCH", amount: "ALL", description: "Rice" },
        ],
      }),
    );
    expect(missing).toContain("mealSnack");
  });

  it("requires what they ate when they ate something", () => {
    const missing = missingFields(
      without({
        meals: [
          { meal: "BREAKFAST", amount: "ALL", description: null },
          { meal: "SNACK", amount: "SOME", description: "Apple" },
          { meal: "LUNCH", amount: "ALL", description: "Rice" },
        ],
      }),
    );
    expect(missing).toContain("mealBreakfastDescription");
  });

  it("does NOT require it when the child was not hungry", () => {
    /*
     * The nursery said every field is mandatory. Read literally, a child who ate
     * nothing could never have a finishable report — there is nothing to write.
     * "Not hungry" is the answer, so the description is not also demanded.
     */
    const missing = missingFields(
      without({
        meals: [
          { meal: "BREAKFAST", amount: "NOT_HUNGRY", description: null },
          { meal: "SNACK", amount: "NOT_HUNGRY", description: "" },
          { meal: "LUNCH", amount: "NOT_HUNGRY", description: null },
        ],
      }),
    );
    expect(missing).toEqual([]);
  });
});

describe("the nap escape", () => {
  it("blocks when neither times nor 'did not sleep' are set", () => {
    expect(
      missingFields(without({ napNone: false, napFrom: null, napUntil: null })),
    ).toContain("nap");
  });

  it("blocks on a half-filled nap", () => {
    expect(
      missingFields(without({ napFrom: "12:30", napUntil: null })),
    ).toContain("nap");
  });

  it("is satisfied by 'did not sleep today'", () => {
    const report = without({ napNone: true, napFrom: null, napUntil: null });
    expect(missingFields(report)).toEqual([]);
  });
});

describe("the toilet escape", () => {
  it("blocks when there are no entries and nothing is declared", () => {
    expect(
      missingFields(without({ toiletEntryCount: 0, toiletNothingToRecord: false })),
    ).toContain("toilet");
  });

  it("is satisfied by 'nothing to record' for a toilet-trained child", () => {
    const report = without({ toiletEntryCount: 0, toiletNothingToRecord: true });
    expect(missingFields(report)).toEqual([]);
  });
});

describe("optional fields never block", () => {
  it("also-enjoyed and bring-tomorrow are not required", () => {
    // They are absent from ReportShape entirely, which is the strongest form of
    // "cannot accidentally become required".
    expect(isComplete(complete)).toBe(true);
  });
});

describe("the missing list is useful, not just truthy", () => {
  it("names every outstanding field so the teacher can be told which", () => {
    const empty: ReportShape = {
      arrivalTime: null,
      playAreas: [],
      quranMemorised: null,
      quranRevision: null,
      littleMuslim: null,
      meals: [],
      napNone: false,
      napFrom: null,
      napUntil: null,
      toiletNothingToRecord: false,
      toiletEntryCount: 0,
      teacherComments: null,
    };

    expect(missingFields(empty)).toEqual([
      "arrivalTime",
      "playAreas",
      "quranMemorised",
      "quranRevision",
      "littleMuslim",
      "mealBreakfast",
      "mealSnack",
      "mealLunch",
      "nap",
      "toilet",
      "teacherComments",
    ]);
  });

  it("lists them in the order of the paper form, so a teacher works down the page", () => {
    const missing = missingFields(
      without({ arrivalTime: null, teacherComments: null }),
    );
    expect(missing).toEqual(["arrivalTime", "teacherComments"]);
  });
});
