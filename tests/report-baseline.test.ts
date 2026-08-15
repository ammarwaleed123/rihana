import { describe, expect, it } from "vitest";

import {
  baselineFrom,
  changedFieldsBetween,
  parseBaseline,
  type ReportBaseline,
} from "@/lib/data/report-baseline";

/**
 * Which fields a save is allowed to write.
 *
 * This decides whether one teacher can blank another's work, so the two
 * directions both matter: a field nobody touched must never be written, and a
 * field somebody did touch must always be.
 *
 * It replaced a browser-side change list that only worked after React had
 * hydrated — so whatever a teacher typed in the first second was silently
 * dropped. These tests are the reason that cannot come back: nothing here can
 * observe when a listener was attached, because there is no listener.
 */

const empty = baselineFrom({});

function withValues(overrides: Partial<Parameters<typeof baselineFrom>[0]>) {
  return baselineFrom(overrides);
}

describe("nothing changed", () => {
  it("reports no fields when the form comes back untouched", () => {
    const before = withValues({
      arrivalTime: "08:15",
      playAreas: ["BLOCKS", "ART"],
      teacherComments: "A good day",
      meals: [{ meal: "LUNCH", amount: "ALL", description: "Rice" }],
      toiletEntries: [{ time: "09:30", wet: true, bm: false, accident: false }],
    });
    expect([...changedFieldsBetween(before, before)]).toEqual([]);
  });

  it("ignores whitespace-only differences", () => {
    const before = withValues({ teacherComments: "A good day" });
    const after = withValues({ teacherComments: "  A good day  " });
    expect([...changedFieldsBetween(before, after)]).toEqual([]);
  });

  it("does not care what order the play areas arrive in", () => {
    const before = withValues({ playAreas: ["ART", "BLOCKS"] });
    const after = withValues({ playAreas: ["BLOCKS", "ART"] });
    expect([...changedFieldsBetween(before, after)]).toEqual([]);
  });
});

describe("one field changed", () => {
  it.each([
    ["arrivalTime", { arrivalTime: "08:15" }],
    ["alsoEnjoyed", { alsoEnjoyed: "Sand tray" }],
    ["quranMemorised", { quranMemorised: "الفاتحة" }],
    ["quranRevision", { quranRevision: "الفاتحة" }],
    ["littleMuslim", { littleMuslim: "آداب الطعام" }],
    ["napFrom", { napFrom: "12:30" }],
    ["napUntil", { napUntil: "13:45" }],
    ["bringOther", { bringOther: "A sun hat" }],
    ["teacherComments", { teacherComments: "Settled" }],
  ] as const)("names %s and nothing else", (field, values) => {
    expect([...changedFieldsBetween(empty, withValues(values))]).toEqual([field]);
  });

  it.each([
    ["napNone", { napNone: true }],
    ["toiletNothingToRecord", { toiletNothingToRecord: true }],
    ["bringCleanClothes", { bringCleanClothes: true }],
    ["bringDiapers", { bringDiapers: true }],
  ] as const)("names the tick box %s", (field, values) => {
    expect([...changedFieldsBetween(empty, withValues(values))]).toEqual([field]);
  });

  it("names play areas when one is added", () => {
    expect([...changedFieldsBetween(empty, withValues({ playAreas: ["ART"] }))]).toEqual([
      "playAreas",
    ]);
  });

  it("names play areas when the last one is removed", () => {
    const before = withValues({ playAreas: ["ART"] });
    expect([...changedFieldsBetween(before, empty)]).toEqual(["playAreas"]);
  });
});

describe("meals are tracked per meal and per column", () => {
  it("separates how much from what they ate", () => {
    const before = withValues({
      meals: [{ meal: "LUNCH", amount: "ALL", description: "Rice" }],
    });
    const after = withValues({
      meals: [{ meal: "LUNCH", amount: "ALL", description: "Rice and chicken" }],
    });
    expect([...changedFieldsBetween(before, after)]).toEqual([
      "meal_LUNCH_description",
    ]);
  });

  it("does not touch the other two meals", () => {
    const after = withValues({
      meals: [{ meal: "SNACK", amount: "SOME", description: "Fruit" }],
    });
    const changed = [...changedFieldsBetween(empty, after)].sort();
    expect(changed).toEqual(["meal_SNACK_amount", "meal_SNACK_description"]);
  });
});

describe("the nappy table is written as a whole", () => {
  it("one line changing marks the set", () => {
    const before = withValues({
      toiletEntries: [{ time: "09:30", wet: true, bm: false, accident: false }],
    });
    const after = withValues({
      toiletEntries: [{ time: "09:30", wet: true, bm: true, accident: false }],
    });
    expect([...changedFieldsBetween(before, after)]).toEqual(["toiletEntries"]);
  });

  it("a line being added marks it too", () => {
    const after = withValues({
      toiletEntries: [{ time: "09:30", wet: true, bm: false, accident: false }],
    });
    expect([...changedFieldsBetween(empty, after)]).toEqual(["toiletEntries"]);
  });
});

/*
 * The concurrency guarantee, stated as a test: a teacher who fills the nap and
 * a teacher who fills lunch must not be able to erase each other, even though
 * each submits the whole form.
 */
describe("two teachers on one report", () => {
  it("the second teacher's save names only her own section", () => {
    // Both loaded the report while it was empty.
    const loaded: ReportBaseline = empty;

    // Teacher A filled the nap; her save carries the whole form.
    const teacherA = withValues({ napFrom: "12:30", napUntil: "13:45" });
    expect([...changedFieldsBetween(loaded, teacherA)].sort()).toEqual([
      "napFrom",
      "napUntil",
    ]);

    // Teacher B, still on the stale page, fills lunch. Her submission still
    // shows the nap as empty — and that must NOT count as clearing it.
    const teacherB = withValues({
      meals: [{ meal: "LUNCH", amount: "ALL", description: "Rice" }],
    });
    const fromB = [...changedFieldsBetween(loaded, teacherB)].sort();
    expect(fromB).toEqual(["meal_LUNCH_amount", "meal_LUNCH_description"]);
    expect(fromB).not.toContain("napFrom");
    expect(fromB).not.toContain("napUntil");
  });

  it("but a deliberate correction to the other teacher's field does count", () => {
    const loaded = withValues({ napFrom: "12:30", napUntil: "13:45" });
    const corrected = withValues({ napFrom: "12:45", napUntil: "13:45" });
    expect([...changedFieldsBetween(loaded, corrected)]).toEqual(["napFrom"]);
  });
});

describe("reading a snapshot back off the wire", () => {
  it("round-trips through JSON", () => {
    const before = withValues({
      arrivalTime: "08:15",
      playAreas: ["ART"],
      meals: [{ meal: "LUNCH", amount: "ALL", description: "Rice" }],
      toiletEntries: [{ time: "09:30", wet: true, bm: false, accident: false }],
    });
    const parsed = parseBaseline(JSON.stringify(before));
    expect(parsed).not.toBeNull();
    expect([...changedFieldsBetween(before, parsed!)]).toEqual([]);
  });

  /*
   * A missing snapshot means "write everything", which is what happened before
   * this existed. It is the safe direction: a stripped field degrades to the old
   * behaviour rather than to a save that quietly stores nothing.
   */
  it.each([null, undefined, "", "not json", "[]", '"a string"'])(
    "returns null for %p so the caller can fall back",
    (raw) => {
      expect(parseBaseline(raw as string)).toBeNull();
    },
  );

  it("tolerates a snapshot with fields missing", () => {
    const parsed = parseBaseline('{"arrivalTime":"08:15"}');
    expect(parsed).not.toBeNull();
    expect(parsed!.playAreas).toEqual([]);
    expect(parsed!.meals).toHaveLength(3);
    expect(parsed!.napNone).toBe(false);
  });
});
