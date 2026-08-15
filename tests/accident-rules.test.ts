import { describe, expect, it } from "vitest";

import {
  acknowledgementIsStale,
  incidentMissingFields,
  isIncidentComplete,
  isValidTime,
  type IncidentShape,
} from "@/lib/data/accident-rules";

/**
 * The completeness rule for an accident record.
 *
 * Worth testing without a database because it is the rule the nursery actually
 * stated — "everything is mandatory" — and because the two escapes below are
 * the only readings under which that rule can be satisfied at all. If either
 * disappears in a refactor, the form becomes impossible to finish on a real day
 * and nobody would find out until a teacher was standing in a classroom holding
 * a hurt child.
 */

/** A complete record. Each test spoils exactly one thing. */
function complete(overrides: Partial<IncidentShape> = {}): IncidentShape {
  return {
    timeOfIncident: "10:15",
    place: "GARDEN",
    placeOther: null,
    figure: "GIRL",
    bodyParts: ["KNEE"],
    nature: ["SCRATCH"],
    natureOther: null,
    treatment: ["RUNNING_WATER"],
    treatmentOther: null,
    description: "Fell while running to the swings.",
    parentsNotified: false,
    doctorNotified: false,
    notificationTime: null,
    signed: true,
    ...overrides,
  };
}

describe("isValidTime", () => {
  it("accepts a zero-padded 24-hour time", () => {
    expect(isValidTime("08:15")).toBe(true);
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["8:15", "24:00", "10:60", "10.15", "", null, undefined]) {
      expect(isValidTime(value as string)).toBe(false);
    }
  });
});

describe("incidentMissingFields", () => {
  it("finds nothing missing in a complete record", () => {
    expect(incidentMissingFields(complete())).toEqual([]);
    expect(isIncidentComplete(complete())).toBe(true);
  });

  it("names each mandatory field that is blank", () => {
    expect(incidentMissingFields(complete({ timeOfIncident: null }))).toEqual([
      "timeOfIncident",
    ]);
    expect(incidentMissingFields(complete({ place: null }))).toEqual(["place"]);
    expect(incidentMissingFields(complete({ figure: null }))).toEqual(["figure"]);
    expect(incidentMissingFields(complete({ bodyParts: [] }))).toEqual([
      "bodyParts",
    ]);
    expect(incidentMissingFields(complete({ nature: [] }))).toEqual(["nature"]);
    expect(incidentMissingFields(complete({ treatment: [] }))).toEqual([
      "treatment",
    ]);
    expect(incidentMissingFields(complete({ description: null }))).toEqual([
      "description",
    ]);
  });

  it("treats whitespace as blank", () => {
    expect(incidentMissingFields(complete({ description: "   " }))).toEqual([
      "description",
    ]);
  });

  it("rejects a malformed time as firmly as a missing one", () => {
    expect(
      incidentMissingFields(complete({ timeOfIncident: "half past ten" })),
    ).toEqual(["timeOfIncident"]);
  });

  it("asks what 'somewhere else' was", () => {
    expect(
      incidentMissingFields(complete({ place: "OTHER", placeOther: null })),
    ).toEqual(["placeOther"]);
    expect(
      incidentMissingFields(
        complete({ place: "OTHER", placeOther: "The corridor" }),
      ),
    ).toEqual([]);
  });

  it("asks what 'something else' was, for injury and for treatment", () => {
    expect(
      incidentMissingFields(complete({ nature: ["OTHER"], natureOther: null })),
    ).toEqual(["natureOther"]);
    expect(
      incidentMissingFields(
        complete({ treatment: ["OTHER"], treatmentOther: null }),
      ),
    ).toEqual(["treatmentOther"]);
  });

  it("does not ask about 'other' text when 'other' was not chosen", () => {
    // A stray sentence left in the box after changing your mind is not a
    // reason to block the form.
    expect(
      incidentMissingFields(
        complete({ place: "GARDEN", placeOther: "left over from earlier" }),
      ),
    ).toEqual([]);
  });

  /*
   * The escape that makes "everything is mandatory" satisfiable: a scrape that
   * needed no phone call has no time of call, and demanding one would mean the
   * form could never be finished honestly.
   */
  it("asks for the time of the call only once someone was called", () => {
    expect(incidentMissingFields(complete())).toEqual([]);

    expect(
      incidentMissingFields(
        complete({ parentsNotified: true, notificationTime: null }),
      ),
    ).toEqual(["notificationTime"]);
    expect(
      incidentMissingFields(
        complete({ doctorNotified: true, notificationTime: null }),
      ),
    ).toEqual(["notificationTime"]);
    expect(
      incidentMissingFields(
        complete({ parentsNotified: true, notificationTime: "10:20" }),
      ),
    ).toEqual([]);
  });

  it("requires the signature", () => {
    expect(incidentMissingFields(complete({ signed: false }))).toEqual([
      "signature",
    ]);
  });

  it("lists everything missing at once, in the order of the paper form", () => {
    const empty: IncidentShape = {
      timeOfIncident: null,
      place: null,
      placeOther: null,
      figure: null,
      bodyParts: [],
      nature: [],
      natureOther: null,
      treatment: [],
      treatmentOther: null,
      description: null,
      parentsNotified: false,
      doctorNotified: false,
      notificationTime: null,
      signed: false,
    };

    expect(incidentMissingFields(empty)).toEqual([
      "timeOfIncident",
      "place",
      "figure",
      "bodyParts",
      "nature",
      "treatment",
      "description",
      "signature",
    ]);
  });
});

describe("acknowledgementIsStale", () => {
  const signed = new Date("2026-08-14T10:00:00Z");

  it("is false when nothing has been signed", () => {
    expect(acknowledgementIsStale(null, signed)).toBe(false);
    expect(acknowledgementIsStale(undefined, signed)).toBe(false);
  });

  it("is false while the record has not changed since the signature", () => {
    expect(acknowledgementIsStale(signed, signed)).toBe(false);
    expect(
      acknowledgementIsStale(signed, new Date("2026-08-14T09:59:00Z")),
    ).toBe(false);
  });

  it("is true once a correction lands after the signature", () => {
    expect(
      acknowledgementIsStale(signed, new Date("2026-08-14T10:00:01Z")),
    ).toBe(true);
  });
});
