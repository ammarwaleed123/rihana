"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { recordAudit } from "@/lib/data/audit";
import { approvePickupPerson, rejectPickupPerson } from "@/lib/data/pickup";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import { pickupRejectionInput } from "@/lib/validation";

/**
 * Owner pickup-approval actions.
 *
 * The authorization gate for the whole feature. Owner-only is enforced in the
 * data layer, not here — this file only shapes the request and records the
 * decision. Both actions redirect back to the queue, where the handled request
 * has already dropped off the list; the outcome rides in the query string.
 */

async function context(session: Session) {
  const headerList = await headers();
  return {
    actor: { id: session.user.id, role: session.user.role },
    ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
  };
}

export async function approvePickupAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const pickupPersonId = String(formData.get("pickupPersonId") ?? "");
  let outcome: "approved" | "gone" = "gone";

  try {
    const { person, changed } = await approvePickupPerson(session, pickupPersonId);

    if (changed) {
      await enqueue(QUEUES.notifyPickupReviewed, { pickupPersonId });
      await recordAudit({
        action: "pickup_person.approved",
        targetType: "pickup_person",
        targetId: pickupPersonId,
        childId: person.child.id,
        summary: `Approved ${person.fullName} to collect ${person.child.firstName}`,
        ...(await context(session)),
      });
      outcome = "approved";
    }

    revalidatePath("/admin/pickup/approvals");
    revalidatePath("/admin/pickup");
  } catch (error) {
    logger.error({ err: error, scope: "approvePickup" }, "approve failed");
  }

  redirect(`/admin/pickup/approvals?${outcome}=1`);
}

export async function rejectPickupAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();

  const parsed = pickupRejectionInput.safeParse({
    pickupPersonId: formData.get("pickupPersonId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/admin/pickup/approvals?error=1");

  let outcome: "rejected" | "gone" = "gone";

  try {
    const { person, changed } = await rejectPickupPerson(
      session,
      parsed.data.pickupPersonId,
      parsed.data.reason,
    );

    if (changed) {
      await enqueue(QUEUES.notifyPickupReviewed, {
        pickupPersonId: parsed.data.pickupPersonId,
      });
      await recordAudit({
        action: "pickup_person.rejected",
        targetType: "pickup_person",
        targetId: parsed.data.pickupPersonId,
        childId: person.child.id,
        summary: `Turned down ${person.fullName} for ${person.child.firstName}`,
        metadata: parsed.data.reason ? { reason: parsed.data.reason } : undefined,
        ...(await context(session)),
      });
      outcome = "rejected";
    }

    revalidatePath("/admin/pickup/approvals");
    revalidatePath("/admin/pickup");
  } catch (error) {
    logger.error({ err: error, scope: "rejectPickup" }, "reject failed");
  }

  redirect(`/admin/pickup/approvals?${outcome}=1`);
}
