/**
 * When is an accident record complete?
 *
 * The nursery's rule, given plainly: every field is mandatory. Unlike the daily
 * report there is no draft — an accident is written once, signed, and goes to
 * the family immediately, so "complete" is checked before the record exists at
 * all rather than before it is sent.
 *
 * Pure, like `report-rules`: no database, no imports from the data layer. Give
 * it a shape, get back what is missing. The form shows exactly what this
 * returns and the action refuses on exactly the same list, so the two cannot
 * drift apart.
 */

export type IncidentMissingField =
  | "timeOfIncident"
  | "place"
  | "placeOther"
  | "figure"
  | "bodyParts"
  | "nature"
  | "natureOther"
  | "treatment"
  | "treatmentOther"
  | "description"
  | "notificationTime"
  | "signature";

export type IncidentShape = {
  timeOfIncident: string | null;
  place: string | null;
  placeOther: string | null;
  figure: string | null;
  bodyParts: readonly string[];
  nature: readonly string[];
  natureOther: string | null;
  treatment: readonly string[];
  treatmentOther: string | null;
  description: string | null;
  parentsNotified: boolean;
  doctorNotified: boolean;
  notificationTime: string | null;
  /** Whether a drawn signature accompanies this submission. */
  signed: boolean;
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
 * Everything still missing before this accident can be recorded.
 *
 * Order follows the paper form, so a teacher reading the list works down the
 * page rather than hunting.
 */
export function incidentMissingFields(
  incident: IncidentShape,
): IncidentMissingField[] {
  const missing: IncidentMissingField[] = [];

  if (!isValidTime(incident.timeOfIncident)) missing.push("timeOfIncident");

  if (blank(incident.place)) missing.push("place");
  // "Other" is only a real answer once it says what the other place was.
  else if (incident.place === "OTHER" && blank(incident.placeOther)) {
    missing.push("placeOther");
  }

  if (blank(incident.figure)) missing.push("figure");
  if (incident.bodyParts.length === 0) missing.push("bodyParts");

  if (incident.nature.length === 0) missing.push("nature");
  else if (incident.nature.includes("OTHER") && blank(incident.natureOther)) {
    missing.push("natureOther");
  }

  if (incident.treatment.length === 0) missing.push("treatment");
  else if (
    incident.treatment.includes("OTHER") &&
    blank(incident.treatmentOther)
  ) {
    missing.push("treatmentOther");
  }

  if (blank(incident.description)) missing.push("description");

  /*
   * The time is required only once somebody was actually called. Demanding it
   * unconditionally would make the form impossible to finish for a scrape that
   * needed no call — the same escape shape as "did not sleep today" on the
   * daily report.
   */
  if (
    (incident.parentsNotified || incident.doctorNotified) &&
    !isValidTime(incident.notificationTime)
  ) {
    missing.push("notificationTime");
  }

  /*
   * The signature is last because it is the act of attesting to everything
   * above it. A record with no signature points at an account, not a person,
   * which is the one thing this form exists to prevent.
   */
  if (!incident.signed) missing.push("signature");

  return missing;
}

export function isIncidentComplete(incident: IncidentShape): boolean {
  return incidentMissingFields(incident).length === 0;
}

/**
 * A cap on one child's day.
 *
 * The paper has one form per accident and the nursery files a second one on a
 * bad day; ten is far past anything real and exists only so a stuck client
 * cannot fill the table.
 */
export const MAX_INCIDENTS_PER_DAY = 10;

/**
 * Has this family's signature been overtaken by an edit?
 *
 * A parent signs a specific account of what happened. When a teacher corrects
 * that account the signature no longer stands for what is on the screen, so the
 * parent is asked again rather than the app quietly implying they agreed to a
 * version they never saw.
 */
export function acknowledgementIsStale(
  acknowledgedAt: Date | null | undefined,
  incidentUpdatedAt: Date,
): boolean {
  if (!acknowledgedAt) return false;
  return acknowledgedAt.getTime() < incidentUpdatedAt.getTime();
}
