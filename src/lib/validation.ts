import { z } from "zod";

/**
 * Input schemas for the admin surface.
 *
 * Every server action validates through one of these at its boundary before any
 * value reaches the database. Shared with client components for inline hints —
 * the client copy is convenience, the server copy is the check.
 */

/** Trimmed, non-empty, length-bounded text. */
const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const cuid = z.string().min(20).max(40);

/** A person's name. Deliberately permissive: names contain apostrophes,
 *  hyphens, spaces, and every script in Unicode. Rejecting "unusual" names is a
 *  reliable way to insult families. Length is the only real constraint. */
export const personName = text(1, 80, "Name");

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export const AGE_GROUPS = ["toddlers", "preschool", "prek"] as const;

export const ageGroupLabels: Record<(typeof AGE_GROUPS)[number], string> = {
  toddlers: "Toddlers (1–2 years)",
  preschool: "Preschool (2–4 years)",
  prek: "Pre-K (4–5 years)",
};

export const classInput = z.object({
  name: text(1, 60, "Class name"),
  ageGroupKey: z.enum(AGE_GROUPS),
  academicYear: text(4, 20, "Academic year"),
});

export type ClassInput = z.infer<typeof classInput>;

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

/**
 * Date of birth.
 *
 * Bounded on both sides: a future date is always a typo, and nobody at a nursery
 * was born more than 12 years ago. Catching this at entry avoids a child sitting
 * in the wrong age group because of a slipped digit.
 */
const dateOfBirth = z
  .string()
  .min(1, "Date of birth is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() <= Date.now(), "Date of birth cannot be in the future")
  .refine(
    (date) => date.getTime() > Date.now() - 12 * 365 * 24 * 3600 * 1000,
    "That date looks too far in the past — please check it",
  );

export const childInput = z.object({
  firstName: personName,
  lastName: personName,
  dateOfBirth,
  classId: cuid.nullable().or(z.literal("").transform(() => null)),
  photoConsent: z.coerce.boolean(),
  allergiesNote: z
    .string()
    .trim()
    .max(500, "Please keep notes under 500 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ChildInput = z.infer<typeof childInput>;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"))
  .refine((v) => v.length <= 254, "That email address is too long");

/**
 * Egyptian mobile number.
 *
 * 11 digits starting `01`, with a real carrier prefix — 010 (Vodafone),
 * 011 (Etisalat), 012 (Orange), 015 (WE). Anything else is a typo: a string of
 * zeros, a landline, a half-typed number.
 *
 * Formatting is forgiving so a parent can paste whatever their contacts app
 * shows — spaces, dashes and parentheses are stripped, and an international
 * `+20` / `0020` prefix is folded back to the local `0`-leading form — but the
 * value is stored in exactly one shape (`01XXXXXXXXX`) so the nursery is never
 * comparing `+20 10…` against `010…` by eye.
 *
 * Optional: an empty field stays empty. When given, it must be valid.
 */
const EGYPT_MOBILE = /^01[0125]\d{8}$/;

export const phone = z
  .string()
  .trim()
  .transform((raw) => {
    // Blank field -> genuinely absent. Distinct from "typed something with no
    // usable digits", which is a typo and must be rejected, not silently
    // dropped — so absence is `null` here and garbage stays a non-null string.
    if (raw === "") return null;

    let digits = raw.replace(/\D/g, "");
    // 0020… (international access code) -> 20…
    if (digits.startsWith("0020")) digits = digits.slice(2);
    // 20 1x xxxx xxxx (country code, leading 0 dropped) -> 01x xxxx xxxx
    if (digits.startsWith("20") && digits.length === 12) {
      digits = `0${digits.slice(2)}`;
    }
    return digits;
  })
  .refine(
    (value) => value === null || EGYPT_MOBILE.test(value),
    "Enter a valid Egyptian mobile number, e.g. 01012345678",
  )
  .transform((value) => value ?? undefined);

export const inviteParentInput = z.object({
  name: personName,
  email,
  phone,
  /** Children to link on creation. May be empty; links can be added later. */
  childIds: z.array(cuid).max(20).default([]),
});

export const inviteTeacherInput = z.object({
  name: personName,
  email,
  phone,
  classIds: z.array(cuid).max(20).default([]),
});

export const GUARDIAN_RELATIONSHIPS = [
  "MOTHER",
  "FATHER",
  "GUARDIAN",
  "OTHER",
] as const;

export const guardianRelationshipLabels: Record<
  (typeof GUARDIAN_RELATIONSHIPS)[number],
  string
> = {
  MOTHER: "Mother",
  FATHER: "Father",
  GUARDIAN: "Guardian",
  OTHER: "Other",
};

export const guardianshipInput = z.object({
  parentUserId: cuid,
  childId: cuid,
  relationship: z.enum(GUARDIAN_RELATIONSHIPS),
  isPrimary: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------

/**
 * The day the photos were taken, not the day they were uploaded.
 *
 * Optional, and past-only with a little slack: a nursery uploads Friday's
 * sports day on Monday, but an event date in 2027 is a slipped digit.
 */
const eventDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : null))
  .refine(
    (date) => date === null || !Number.isNaN(date.getTime()),
    "Enter a valid date",
  )
  .refine(
    (date) => date === null || date.getTime() <= Date.now() + 86_400_000,
    "An event date cannot be in the future",
  );

export const albumInput = z.object({
  title: text(1, 80, "Album title"),
  description: z
    .string()
    .trim()
    .max(500, "Please keep the description under 500 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Empty means the whole nursery. Owner-only; enforced in the data layer.
  classId: cuid.nullable().or(z.literal("").transform(() => null)),
  eventDate,
});

export type AlbumInput = z.infer<typeof albumInput>;

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

/**
 * Deleting a child destroys their photos irreversibly, so the confirmation is
 * typing the child's full name rather than clicking "OK". Checked server-side.
 */
export const deleteChildInput = z.object({
  childId: cuid,
  confirmName: z.string().trim().min(1, "Type the child's name to confirm"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collapse a ZodError into the first message per field, for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    output[key] ??= issue.message;
  }
  return output;
}

/** Read a repeated form field (multi-select, checkbox group) as a string array. */
export function readAll(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}
