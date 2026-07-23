"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import {
  createAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
} from "@/lib/data/announcements";
import { recordAudit } from "@/lib/data/audit";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { announcementInput, fieldErrors } from "@/lib/validation";

export type AnnouncementState = {
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

function toState(error: unknown, scope: string): AnnouncementState {
  if (error instanceof ForbiddenError) return { error: error.message };
  if (error instanceof NotFoundError) {
    return { error: "That announcement no longer exists." };
  }
  logger.error({ err: error, scope }, "announcement action failed");
  return { error: "Something went wrong. Please try again." };
}

function parse(formData: FormData) {
  return announcementInput.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audience: formData.get("audience"),
    classId: formData.get("classId"),
  });
}

export async function createAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const session = await requireSessionOrThrow();
  const parsed = parse(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  let id: string;
  try {
    const created = await createAnnouncement(session, parsed.data);
    await recordAudit({
      action: "announcement.published",
      targetType: "announcement",
      targetId: created.id,
      summary: `Drafted the announcement "${created.title}"`,
      ...(await context(session)),
    });
    revalidatePath("/admin/announcements");
    id = created.id;
  } catch (error) {
    return toState(error, "createAnnouncement");
  }

  redirect(`/admin/announcements/${id}`);
}

export async function updateAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("announcementId") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    await updateAnnouncement(session, id, parsed.data);
    revalidatePath("/admin/announcements");
    revalidatePath(`/admin/announcements/${id}`);
    return { success: "Announcement saved." };
  } catch (error) {
    return toState(error, "updateAnnouncement");
  }
}

export async function publishAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("announcementId") ?? "");

  try {
    const result = await publishAnnouncement(session, id);
    await recordAudit({
      action: "announcement.published",
      targetType: "announcement",
      targetId: id,
      summary: `Published the announcement "${result.title}"`,
      ...(await context(session)),
    });
    revalidatePath("/admin/announcements");
    revalidatePath(`/admin/announcements/${id}`);
  } catch (error) {
    return toState(error, "publishAnnouncement");
  }

  redirect(`/admin/announcements/${id}?published=1`);
}

export async function unpublishAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("announcementId") ?? "");

  try {
    await unpublishAnnouncement(session, id);
    revalidatePath("/admin/announcements");
    revalidatePath(`/admin/announcements/${id}`);
  } catch (error) {
    return toState(error, "unpublishAnnouncement");
  }

  redirect(`/admin/announcements/${id}?withdrawn=1`);
}

export async function deleteAnnouncementAction(
  _prev: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("announcementId") ?? "");

  let title: string;
  try {
    const deleted = await deleteAnnouncement(session, id);
    revalidatePath("/admin/announcements");
    title = deleted.title;
  } catch (error) {
    return toState(error, "deleteAnnouncement");
  }

  redirect(`/admin/announcements?deleted=${encodeURIComponent(title)}`);
}
