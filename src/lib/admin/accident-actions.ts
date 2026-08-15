"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import {
  createIncident,
  deleteIncident,
  updateIncident,
  type IncidentInput,
} from "@/lib/data/accident-reports";
import type { IncidentMissingField } from "@/lib/data/accident-rules";
import { recordAudit } from "@/lib/data/audit";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { UnsupportedImageError, processSignature } from "@/lib/images/process";
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import { signatureKey, storage } from "@/lib/storage";
import {
  ACCIDENT_PLACES,
  BODY_FIGURES,
  BODY_PARTS,
  INJURY_NATURES,
  INJURY_TREATMENTS,
  accidentIncidentInput,
  fieldErrors,
  readAll,
  signatureDataUrl,
} from "@/lib/validation";

/*
 * No revalidatePath, for the reason the daily report learned the hard way: every
 * admin route is dynamic, so there is nothing cached to invalidate, and calling
 * it anyway resets the form's action state while leaving the stale server render
 * on screen — the teacher is told nothing while the write behind her succeeds.
 */

export type AccidentState = {
  error?: string;
  success?: "recorded" | "corrected" | "deleted";
  errors?: Record<string, string>;
  /** What is still stopping this being recorded, for the interface to name. */
  missing?: IncidentMissingField[];
};

async function context(session: Session) {
  const headerList = await headers();
  return {
    actor: { id: session.user.id, role: session.user.role },
    ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
  };
}

function toState(error: unknown, scope: string): AccidentState {
  if (error instanceof ForbiddenError) return { error: error.message };
  if (error instanceof UnsupportedImageError) return { error: error.message };
  if (error instanceof NotFoundError) {
    return { error: "That record no longer exists." };
  }
  logger.error({ err: error, scope }, "accident action failed");
  return { error: "Something went wrong. Please try again." };
}

function bool(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Empty string means "not filled in", which is null in the database. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function within<T extends string>(
  value: string,
  allowed: readonly T[],
): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function parse(formData: FormData) {
  return accidentIncidentInput.safeParse({
    timeOfIncident: str(formData, "timeOfIncident"),
    place: within(str(formData, "place"), ACCIDENT_PLACES),
    placeOther: str(formData, "placeOther"),
    figure: within(str(formData, "figure"), BODY_FIGURES),
    bodyParts: readAll(formData, "bodyParts").filter((v) =>
      (BODY_PARTS as readonly string[]).includes(v),
    ),
    nature: readAll(formData, "nature").filter((v) =>
      (INJURY_NATURES as readonly string[]).includes(v),
    ),
    natureOther: str(formData, "natureOther"),
    treatment: readAll(formData, "treatment").filter((v) =>
      (INJURY_TREATMENTS as readonly string[]).includes(v),
    ),
    treatmentOther: str(formData, "treatmentOther"),
    description: str(formData, "description"),
    parentsNotified: bool(formData, "parentsNotified"),
    doctorNotified: bool(formData, "doctorNotified"),
    notificationTime: str(formData, "notificationTime"),
  });
}

/**
 * Shape the parsed form into what the data layer stores.
 *
 * The "other" free-text boxes are dropped unless the option they belong to was
 * actually chosen. Otherwise a teacher who types into "other", changes her mind
 * and picks a listed option leaves a stray sentence behind on the record a
 * parent reads.
 */
function toInput(parsed: NonNullable<ReturnType<typeof parse>["data"]>) {
  return {
    timeOfIncident: parsed.timeOfIncident.trim(),
    place: parsed.place ?? "",
    placeOther: parsed.place === "OTHER" ? orNull(parsed.placeOther) : null,
    figure: parsed.figure ?? "",
    bodyParts: parsed.bodyParts,
    nature: parsed.nature,
    natureOther: parsed.nature.includes("OTHER")
      ? orNull(parsed.natureOther)
      : null,
    treatment: parsed.treatment,
    treatmentOther: parsed.treatment.includes("OTHER")
      ? orNull(parsed.treatmentOther)
      : null,
    description: parsed.description.trim(),
    parentsNotified: parsed.parentsNotified,
    doctorNotified: parsed.doctorNotified,
    // Meaningless once nobody was called, and keeping it would leave a time on
    // the record next to "no one was notified".
    notificationTime:
      parsed.parentsNotified || parsed.doctorNotified
        ? orNull(parsed.notificationTime)
        : null,
  } satisfies IncidentInput;
}

/**
 * Turn the drawn signature into a stored object.
 *
 * Written to storage BEFORE the row, because a row pointing at an object that
 * does not exist is a record whose signature cannot be produced — worse than a
 * stray object, which the failure path below removes anyway.
 */
async function storeSignature(
  dataUrl: string,
): Promise<{ key: string } | { error: string }> {
  const checked = signatureDataUrl.safeParse(dataUrl);
  if (!checked.success) {
    return { error: checked.error.issues[0]?.message ?? "Please sign in the box" };
  }

  const image = await processSignature(checked.data);
  const key = signatureKey("incident", randomUUID());
  await storage.put(key, image.buffer, { contentType: "image/jpeg" });
  return { key };
}

/** Best-effort cleanup. A failed purge must not fail the request behind it. */
async function discard(keys: string[]) {
  if (keys.length === 0) return;
  try {
    await storage.deleteMany(keys);
  } catch (error) {
    logger.warn({ err: error, keys }, "could not remove superseded signature");
  }
}

async function runRecord(formData: FormData): Promise<AccidentState> {
  const reportId = str(formData, "reportId");

  try {
    const session = await requireSessionOrThrow();
    const parsed = parse(formData);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    const stored = await storeSignature(str(formData, "signature"));
    if ("error" in stored) return { missing: ["signature"] };

    const result = await createIncident(
      session,
      reportId,
      toInput(parsed.data),
      stored.key,
    );

    if (!result.created) {
      // Nothing points at the object now and nothing ever will.
      await discard([stored.key]);
      return { missing: result.missing };
    }

    await recordAudit({
      ...(await context(session)),
      action: "accident.recorded",
      summary: `Recorded an accident for ${result.child.firstName} ${result.child.lastName} at ${result.date.toISOString().slice(0, 10)}`,
      childId: result.childId,
      targetType: "accident_incident",
      targetId: result.incidentId,
    });

    // The most urgent message this app sends, so it leaves immediately — but
    // through the queue, because it fans out to every guardian and sends push,
    // and the teacher should not be watching a spinner for any of that.
    await enqueue(QUEUES.notifyAccident, { incidentId: result.incidentId });

    return { success: "recorded" };
  } catch (error) {
    return toState(error, "accident-record");
  }
}

async function runCorrect(formData: FormData): Promise<AccidentState> {
  const incidentId = str(formData, "incidentId");

  try {
    const session = await requireSessionOrThrow();
    const parsed = parse(formData);
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };

    const stored = await storeSignature(str(formData, "signature"));
    if ("error" in stored) return { missing: ["signature"] };

    const result = await updateIncident(
      session,
      incidentId,
      toInput(parsed.data),
      stored.key,
    );

    if (!result.updated) {
      await discard([stored.key]);
      return { missing: result.missing };
    }

    // Only now that the row points at the new signature is the old one safe to
    // remove.
    await discard([result.previousSignatureKey]);

    await recordAudit({
      ...(await context(session)),
      action: "accident.corrected",
      summary: `Corrected the accident record for ${result.child.firstName} ${result.child.lastName} at ${result.date.toISOString().slice(0, 10)}`,
      childId: result.childId,
      targetType: "accident_incident",
      targetId: incidentId,
    });

    // A parent who read "a scratch" and would now read "a cut" has to be told.
    await enqueue(QUEUES.notifyAccident, { incidentId });

    return { success: "corrected" };
  } catch (error) {
    return toState(error, "accident-correct");
  }
}

async function runDelete(formData: FormData): Promise<AccidentState> {
  const incidentId = str(formData, "incidentId");

  try {
    const session = await requireSessionOrThrow();
    const result = await deleteIncident(session, incidentId);

    await discard(result.orphanedKeys);

    await recordAudit({
      ...(await context(session)),
      action: "accident.deleted",
      summary: `Deleted the ${result.timeOfIncident} accident record for ${result.child.firstName} ${result.child.lastName} on ${result.date.toISOString().slice(0, 10)}`,
      childId: result.childId,
      targetType: "accident_incident",
      targetId: incidentId,
    });

    return { success: "deleted" };
  } catch (error) {
    return toState(error, "accident-delete");
  }
}

/**
 * One action for the whole screen, dispatched on an `intent` field — not
 * several actions attached to buttons via `formAction`, which runs the right
 * code but never returns its result to the `useActionState` that owns the form.
 */
export async function accidentAction(
  _prev: AccidentState,
  formData: FormData,
): Promise<AccidentState> {
  switch (str(formData, "intent")) {
    case "correct":
      return runCorrect(formData);
    case "delete":
      return runDelete(formData);
    default:
      return runRecord(formData);
  }
}
