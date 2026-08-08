"use server";

import { headers } from "next/headers";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { hashIp } from "@/lib/auth/tokens";
import { createInquiry } from "@/lib/data/inquiries";
import { consumeRateLimit } from "@/lib/data/rate-limit";
import { env } from "@/lib/env";
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import { fieldErrors, inquiryInput } from "@/lib/validation";

/**
 * The public admissions inquiry.
 *
 * This is an open, unauthenticated endpoint, so it is the most abuse-exposed
 * surface in the app. Two cheap defences, both here at the boundary:
 *
 *   - A honeypot field ("company"): invisible to people, catnip to bots. Anything
 *     that fills it gets a friendly success and nothing is written.
 *   - A per-IP rate limit: five inquiries an hour is generous for a real family
 *     and useless for a script.
 *
 * Beyond that it is the same shape as every other action: validate at the
 * boundary, then hand clean input to the data layer.
 */

export type InquiryState = {
  error?: string;
  success?: string;
  errors?: Record<string, string>;
};

export async function submitInquiryAction(
  _prev: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  // Honeypot. A real person never sees this field, so a value means a bot —
  // answer as if it worked, but write nothing.
  if (String(formData.get("company") ?? "").trim() !== "") {
    return { success: "Thank you! We'll be in touch very soon." };
  }

  const headerList = await headers();
  const ipHash = hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET);

  const limit = await consumeRateLimit("inquiry:ip", ipHash ?? "unknown", 5, 3600);
  if (!limit.allowed) {
    return {
      error:
        "You've sent us a few messages already. Please try again a little later, or give us a call.",
    };
  }

  const parsed = inquiryInput.safeParse({
    // `?? undefined`: an absent field is `null` from FormData, but the schema's
    // default/optional only kick in on `undefined`. `preferredVisit` is only in
    // the DOM for a visit request, and `kind` should fall back to the default.
    kind: formData.get("kind") ?? undefined,
    parentName: formData.get("parentName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    childFirstName: formData.get("childFirstName"),
    childDateOfBirth: formData.get("childDateOfBirth"),
    preferredStartDate: formData.get("preferredStartDate"),
    preferredVisit: formData.get("preferredVisit") ?? undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  try {
    const created = await createInquiry(parsed.data, { ipHash });

    // Let the owners know on their bell, off the request via the worker.
    await enqueue(QUEUES.notifyNewInquiry, { inquiryId: created.id });

    return {
      success:
        "Thank you! We've got your message and one of the team will be in touch very soon.",
    };
  } catch (error) {
    logger.error({ err: error, scope: "submitInquiry" }, "inquiry create failed");
    return {
      error:
        "Something went wrong sending your message. Please try again, or give us a call.",
    };
  }
}
