"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionOrThrow } from "@/lib/auth/scope";
import {
  markAllNotificationsRead,
  openNotification,
} from "@/lib/data/notifications";

/**
 * Staff notification actions.
 *
 * The same two actions as the portal, but revalidating the `/admin` layout —
 * that is where the staff bell's unread count is rendered. Both scope to the
 * caller in the data layer, so a tampered id touches nobody else's notifications,
 * and the redirect target is the notification's own stored path, never one the
 * request supplied.
 */

export async function markAllReadAction(): Promise<void> {
  const session = await requireSessionOrThrow();
  await markAllNotificationsRead(session);
  revalidatePath("/admin", "layout");
}

export async function openNotificationAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("notificationId") ?? "");

  const linkPath = await openNotification(session, id);
  revalidatePath("/admin", "layout");

  redirect(linkPath ?? "/admin/notifications");
}
