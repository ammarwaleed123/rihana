"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { recordAudit } from "@/lib/data/audit";
import { verifyPasswordForUser } from "@/lib/data/auth";
import {
  addPickupPerson,
  attachPickupPhoto,
  revokePickupPerson,
  setPickupMethod,
  updatePickupPerson,
} from "@/lib/data/pickup";
import { consumeRateLimit } from "@/lib/data/rate-limit";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import {
  createThumbnail,
  processUpload,
  UnsupportedImageError,
} from "@/lib/images/process";
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import { pickupPersonKey, storage } from "@/lib/storage";
import {
  fieldErrors,
  PICKUP_METHODS,
  pickupPersonInput,
} from "@/lib/validation";

/**
 * Parent pickup actions.
 *
 * Adding, editing, or changing the method are all safety-critical, so each
 * re-checks the parent's password server-side inside the action — never a
 * client-asserted "recently verified" flag (§29). Removing a person is not
 * gated: it only ever *reduces* who may collect a child, the safe direction.
 */

export type PickupState = {
  error?: string;
  success?: string;
  errors?: Record<string, string>;
};

async function context(session: Session) {
  const headerList = await headers();
  return {
    actor: { id: session.user.id, role: session.user.role },
    ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
  };
}

/**
 * Ten re-auth attempts an hour, keyed on the account.
 *
 * The attacker here is already holding the parent's unlocked browser, so the
 * limit is against online guessing of a known user's password — generous for a
 * typo, useless for a guess. Shared shape with the account actions.
 */
async function reauthAllowed(userId: string): Promise<boolean> {
  const limit = await consumeRateLimit("reauth:user", userId, 10, 3600);
  return limit.allowed;
}

function toState(error: unknown, scope: string): PickupState {
  if (error instanceof ForbiddenError) return { error: "You cannot do that." };
  if (error instanceof NotFoundError) {
    return { error: "That is no longer available." };
  }
  logger.error({ err: error, scope }, "pickup action failed");
  return { error: "Something went wrong. Please try again." };
}

/** Re-encode an uploaded avatar into a display image and a thumbnail. */
async function processPickupPhoto(
  file: File,
): Promise<{ photo: Buffer; thumb: Buffer }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  // Same defusing as child photos: sharp re-encodes, strips EXIF, and rejects
  // anything that is not a real image.
  const processed = await processUpload(buffer);
  const thumb = await createThumbnail(processed.web.buffer);
  return { photo: processed.web.buffer, thumb: thumb.buffer };
}

async function storePickupPhoto(
  pickupPersonId: string,
  images: { photo: Buffer; thumb: Buffer },
): Promise<void> {
  const photoKey = pickupPersonKey(pickupPersonId, "photo");
  const thumbKey = pickupPersonKey(pickupPersonId, "thumb");
  await storage.put(photoKey, images.photo, { contentType: "image/jpeg" });
  await storage.put(thumbKey, images.thumb, { contentType: "image/jpeg" });
  await attachPickupPhoto(pickupPersonId, photoKey, thumbKey);
}

function parsePerson(formData: FormData) {
  return pickupPersonInput.safeParse({
    fullName: formData.get("fullName"),
    relationship: formData.get("relationship"),
    phone: formData.get("phone"),
    expiresAt: formData.get("expiresAt"),
  });
}

/** Confirm the current password. Returns an error state, or null on success. */
async function confirmPassword(
  session: Session,
  formData: FormData,
): Promise<PickupState | null> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  if (!currentPassword) {
    return { errors: { currentPassword: "Enter your password to confirm" } };
  }

  if (!(await reauthAllowed(session.user.id))) {
    return { error: "Too many attempts. Please try again later." };
  }

  const confirmed = await verifyPasswordForUser(session.user.id, currentPassword);
  if (!confirmed) {
    await recordAudit({
      action: "auth.sign_in_failed",
      targetType: "user",
      targetId: session.user.id,
      summary: "Failed password re-entry on a pickup change",
      ...(await context(session)),
    });
    return { errors: { currentPassword: "That is not your current password" } };
  }

  return null;
}

export async function addPickupPersonAction(
  _prev: PickupState,
  formData: FormData,
): Promise<PickupState> {
  const session = await requireSessionOrThrow();
  const childId = String(formData.get("childId") ?? "");

  const parsed = parsePerson(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const reauth = await confirmPassword(session, formData);
  if (reauth) return reauth;

  // Reject a bad photo before creating anything, so a good submission always
  // ends up with its photo and a bad one changes nothing.
  let images: { photo: Buffer; thumb: Buffer } | null = null;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    try {
      images = await processPickupPhoto(file);
    } catch (error) {
      if (error instanceof UnsupportedImageError) {
        return { errors: { photo: error.message } };
      }
      return toState(error, "addPickup.photo");
    }
  }

  let redirectTo: string | null = null;
  try {
    const created = await addPickupPerson(session, childId, parsed.data);

    if (images) {
      // The person is valid without a photo, so a storage hiccup here is logged
      // rather than allowed to fail the whole request.
      try {
        await storePickupPhoto(created.id, images);
      } catch (error) {
        logger.warn(
          { err: error, scope: "addPickup.store", id: created.id },
          "pickup photo could not be stored",
        );
      }
    }

    await enqueue(QUEUES.notifyPickupPending, { pickupPersonId: created.id });

    await recordAudit({
      action: "pickup_person.created",
      targetType: "pickup_person",
      targetId: created.id,
      childId,
      summary: `Requested authorization for ${created.fullName} to collect a child`,
      ...(await context(session)),
    });

    revalidatePath("/portal/pickup");
    revalidatePath(`/portal/pickup/${childId}`);
    redirectTo = `/portal/pickup/${childId}?added=1`;
  } catch (error) {
    return toState(error, "addPickup");
  }

  redirect(redirectTo);
}

export async function updatePickupPersonAction(
  _prev: PickupState,
  formData: FormData,
): Promise<PickupState> {
  const session = await requireSessionOrThrow();
  const pickupPersonId = String(formData.get("pickupPersonId") ?? "");
  const childId = String(formData.get("childId") ?? "");

  const parsed = parsePerson(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const reauth = await confirmPassword(session, formData);
  if (reauth) return reauth;

  let images: { photo: Buffer; thumb: Buffer } | null = null;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    try {
      images = await processPickupPhoto(file);
    } catch (error) {
      if (error instanceof UnsupportedImageError) {
        return { errors: { photo: error.message } };
      }
      return toState(error, "updatePickup.photo");
    }
  }

  let redirectTo: string | null = null;
  try {
    const updated = await updatePickupPerson(session, pickupPersonId, parsed.data);

    if (images) {
      try {
        await storePickupPhoto(updated.id, images);
      } catch (error) {
        logger.warn(
          { err: error, scope: "updatePickup.store", id: updated.id },
          "pickup photo could not be stored",
        );
      }
    }

    // An edit returns the person to PENDING, so the owners are prompted again.
    await enqueue(QUEUES.notifyPickupPending, { pickupPersonId: updated.id });

    await recordAudit({
      action: "pickup_person.updated",
      targetType: "pickup_person",
      targetId: updated.id,
      childId: updated.childId,
      summary: `Edited ${updated.fullName}${updated.wasApproved ? " — sent back for approval" : ""}`,
      ...(await context(session)),
    });

    revalidatePath("/portal/pickup");
    revalidatePath(`/portal/pickup/${childId}`);
    redirectTo = `/portal/pickup/${childId}?updated=1`;
  } catch (error) {
    return toState(error, "updatePickup");
  }

  redirect(redirectTo);
}

/**
 * Remove a pickup person. Not password-gated: it only removes access.
 *
 * A plain form action — its success (the person vanishing from the list) is
 * visible on the page it returns to, so there is no message to carry.
 */
export async function revokePickupPersonAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const pickupPersonId = String(formData.get("pickupPersonId") ?? "");
  const childId = String(formData.get("childId") ?? "");

  try {
    const person = await revokePickupPerson(session, pickupPersonId);

    // Purge the avatar we no longer need. Non-fatal — the row is already gone.
    const keys = [person.photoStorageKey, person.photoThumbKey].filter(
      (k): k is string => Boolean(k),
    );
    if (keys.length > 0) await enqueue(QUEUES.storagePurge, { keys });

    await recordAudit({
      action: "pickup_person.revoked",
      targetType: "pickup_person",
      targetId: pickupPersonId,
      childId: person.childId,
      summary: `Removed ${person.fullName} as a pickup person`,
      ...(await context(session)),
    });

    revalidatePath("/portal/pickup");
    revalidatePath(`/portal/pickup/${childId}`);
  } catch (error) {
    logger.warn({ err: error, scope: "revokePickup" }, "could not revoke");
  }

  redirect(childId ? `/portal/pickup/${childId}` : "/portal/pickup");
}

export async function setPickupMethodAction(
  _prev: PickupState,
  formData: FormData,
): Promise<PickupState> {
  const session = await requireSessionOrThrow();
  const childId = String(formData.get("childId") ?? "");
  const method = String(formData.get("method") ?? "");

  if (!PICKUP_METHODS.includes(method as (typeof PICKUP_METHODS)[number])) {
    return { error: "Choose a pickup arrangement." };
  }

  const reauth = await confirmPassword(session, formData);
  if (reauth) return reauth;

  try {
    const result = await setPickupMethod(
      session,
      childId,
      method as (typeof PICKUP_METHODS)[number],
    );

    if (result.before !== result.after) {
      await recordAudit({
        action: "pickup_method.changed",
        targetType: "child",
        targetId: childId,
        childId,
        summary: `Set ${result.firstName}'s pickup to ${result.after === "BUS" ? "the nursery bus" : "door handover"}`,
        metadata: { before: result.before, after: result.after },
        ...(await context(session)),
      });
    }

    revalidatePath("/portal/pickup");
    revalidatePath(`/portal/pickup/${childId}`);

    return {
      success:
        result.after === "BUS"
          ? "Saved — this child goes home on the nursery bus."
          : "Saved — this child is collected at the door.",
    };
  } catch (error) {
    return toState(error, "setPickupMethod");
  }
}
