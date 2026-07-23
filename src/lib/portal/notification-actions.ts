"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionOrThrow } from "@/lib/auth/scope";
import {
  markAllNotificationsRead,
  openNotification,
} from "@/lib/data/notifications";

/**
 * Notification actions.
 *
 * Both scope to the caller in the data layer, so a tampered id touches nobody
 * else's notifications. The layout is revalidated because the unread count lives
 * in the header, which every portal page renders.
 */

export async function markAllReadAction(): Promise<void> {
  const session = await requireSessionOrThrow();
  await markAllNotificationsRead(session);
  revalidatePath("/portal", "layout");
}

/**
 * Tapping a notification marks it read AND goes to what it is about.
 *
 * The destination comes from the notification's own stored `linkPath`, resolved
 * in the data layer for this user — never from the form — so it cannot be turned
 * into an open redirect. The redirect sits outside any try/catch because Next
 * signals it by throwing.
 */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  const id = String(formData.get("notificationId") ?? "");

  const linkPath = await openNotification(session, id);
  revalidatePath("/portal", "layout");

  redirect(linkPath ?? "/portal/notifications");
}
