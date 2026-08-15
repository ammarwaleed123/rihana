"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { acknowledgeIncident } from "@/lib/data/accident-reports";
import { recordAudit } from "@/lib/data/audit";
import { env } from "@/lib/env";
import { UnsupportedImageError, processSignature } from "@/lib/images/process";
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import { signatureKey, storage } from "@/lib/storage";
import { signatureDataUrl } from "@/lib/validation";

export type SignAccidentState = {
  error?: string;
  done?: boolean;
  /** Which incident the result belongs to — one page shows several. */
  incidentId?: string;
};

/**
 * A guardian signs to say they were told about an accident.
 *
 * Per incident, not per day: signing for the morning does not stand for an
 * afternoon they have not yet seen. Re-signing after a teacher corrects the
 * record replaces the signature, and the superseded image is removed — a
 * signature nothing points at is a signature nobody consented to keep.
 */
export async function signAccidentAction(
  _prev: SignAccidentState,
  formData: FormData,
): Promise<SignAccidentState> {
  const incidentId = String(formData.get("incidentId") ?? "");

  try {
    const session = await requireSessionOrThrow();

    const checked = signatureDataUrl.safeParse(
      String(formData.get("signature") ?? ""),
    );
    if (!checked.success) {
      return {
        incidentId,
        error: checked.error.issues[0]?.message ?? "Please sign in the box",
      };
    }

    const image = await processSignature(checked.data);
    const key = signatureKey("acknowledgement", randomUUID());
    await storage.put(key, image.buffer, { contentType: "image/jpeg" });

    let result;
    try {
      result = await acknowledgeIncident(session, incidentId, key);
    } catch (error) {
      // The row was never written, so nothing will ever point at this object.
      await discard([key]);
      throw error;
    }

    await discard([result.previousSignatureKey]);

    const headerList = await headers();
    await recordAudit({
      actor: { id: session.user.id, role: session.user.role },
      ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
      userAgent: headerList.get("user-agent"),
      action: "accident.acknowledged",
      summary: `A guardian signed the ${result.timeOfIncident} accident record`,
      childId: result.childId,
      targetType: "accident_incident",
      targetId: incidentId,
    });

    // Tell the class's teachers and the owners. This is the one acknowledgement
    // anybody actually asks about — "have the parents seen it yet".
    await enqueue(QUEUES.notifyAccidentAcknowledged, {
      incidentId,
      parentUserId: session.user.id,
    });

    return { done: true, incidentId };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { incidentId, error: error.message };
    }
    if (error instanceof UnsupportedImageError) {
      return { incidentId, error: error.message };
    }
    if (error instanceof NotFoundError) {
      return { incidentId, error: "That record is no longer available." };
    }
    logger.error({ err: error, scope: "accident-sign" }, "signature failed");
    return { incidentId, error: "Something went wrong. Please try again." };
  }
}

/** Best-effort cleanup. A failed purge must not fail the request behind it. */
async function discard(keys: Array<string | null>) {
  const real = keys.filter((key): key is string => Boolean(key));
  if (real.length === 0) return;
  try {
    await storage.deleteMany(real);
  } catch (error) {
    logger.warn({ err: error, keys: real }, "could not remove old signature");
  }
}
