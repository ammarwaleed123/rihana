"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionOrThrow } from "@/lib/auth/scope";
import {
  updateInquiry,
  type InquiryStatusValue,
} from "@/lib/data/inquiries";
import { logger } from "@/lib/logger";
import { INQUIRY_STATUSES } from "@/lib/validation";

/**
 * Owner-side inquiry management. Owner-only is enforced in the data layer.
 */

export async function setInquiryStatusAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("inquiryId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!INQUIRY_STATUSES.includes(status as (typeof INQUIRY_STATUSES)[number])) {
    redirect(`/admin/inquiries/${id}`);
  }

  try {
    await updateInquiry(session, id, { status: status as InquiryStatusValue });
    revalidatePath("/admin/inquiries");
    revalidatePath(`/admin/inquiries/${id}`);
    // The dashboard count and nav badge track NEW inquiries.
    revalidatePath("/admin", "layout");
  } catch (error) {
    logger.error({ err: error, scope: "setInquiryStatus" }, "status change failed");
  }

  redirect(`/admin/inquiries/${id}?updated=1`);
}

export type NotesState = { success?: string; error?: string };

export async function saveInquiryNotesAction(
  _prev: NotesState,
  formData: FormData,
): Promise<NotesState> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("inquiryId") ?? "");
  const notes = String(formData.get("internalNotes") ?? "").trim();

  try {
    await updateInquiry(session, id, { internalNotes: notes || null });
    revalidatePath(`/admin/inquiries/${id}`);
    return { success: "Notes saved." };
  } catch (error) {
    logger.error({ err: error, scope: "saveInquiryNotes" }, "notes save failed");
    return { error: "Could not save your notes. Please try again." };
  }
}
