"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import {
  addPhotosToAlbum,
  createAlbum,
  deleteAlbum,
  publishAlbum,
  removePhotoFromAlbum,
  setAlbumCover,
  unpublishAlbum,
  updateAlbum,
} from "@/lib/data/albums";
import { recordAudit } from "@/lib/data/audit";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { albumInput, fieldErrors, readAll } from "@/lib/validation";

/**
 * Album server actions.
 *
 * Thin on purpose: parse, delegate to the data layer, audit, revalidate. Not
 * one of them decides who may do what — that lives in `src/lib/data/albums.ts`
 * so it holds for any caller, including a future job or CLI that never passes
 * through a form post.
 */

export type AlbumFormState = {
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

function toState(error: unknown, scope: string): AlbumFormState {
  if (error instanceof ForbiddenError) return { error: error.message };
  if (error instanceof NotFoundError) {
    return { error: "That album no longer exists." };
  }

  logger.error({ err: error, scope }, "album action failed");
  return { error: "Something went wrong. Please try again." };
}

function parse(formData: FormData) {
  return albumInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    classId: formData.get("classId"),
    eventDate: formData.get("eventDate"),
  });
}

export async function createAlbumAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const parsed = parse(formData);

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Redirecting straight into the new album: an album with no photos is not
  // useful, and dropping staff back on a list makes it easy to walk away
  // having created an empty one.
  let albumId: string;

  try {
    const album = await createAlbum(session, parsed.data);

    await recordAudit({
      action: "album.created",
      targetType: "album",
      targetId: album.id,
      summary: `Created the album "${album.title}"`,
      ...(await context(session)),
    });

    revalidatePath("/admin/albums");
    albumId = album.id;
  } catch (error) {
    return toState(error, "createAlbum");
  }

  redirect(`/admin/albums/${albumId}`);
}

export async function updateAlbumAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const albumId = String(formData.get("albumId") ?? "");
  const parsed = parse(formData);

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    await updateAlbum(session, albumId, parsed.data);

    revalidatePath("/admin/albums");
    revalidatePath(`/admin/albums/${albumId}`);
    return { success: "Album details saved." };
  } catch (error) {
    return toState(error, "updateAlbum");
  }
}

export async function addPhotosAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const albumId = String(formData.get("albumId") ?? "");
  const photoIds = readAll(formData, "photoIds");

  if (photoIds.length === 0) return { error: "Choose at least one photo." };

  try {
    const result = await addPhotosToAlbum(session, albumId, photoIds);

    revalidatePath(`/admin/albums/${albumId}`);

    // `skipped` means photos the caller is not allowed to reach. Surfaced
    // rather than swallowed: silently adding fewer photos than were ticked
    // looks like the feature is broken.
    return {
      success:
        result.skipped > 0
          ? `Added ${result.added} photo${result.added === 1 ? "" : "s"}. ${result.skipped} could not be added.`
          : `Added ${result.added} photo${result.added === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return toState(error, "addPhotosToAlbum");
  }
}

export async function removePhotoAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const albumId = String(formData.get("albumId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");

  try {
    await removePhotoFromAlbum(session, albumId, photoId);

    revalidatePath(`/admin/albums/${albumId}`);
    return { success: "Removed from this album. The photo itself is untouched." };
  } catch (error) {
    return toState(error, "removePhotoFromAlbum");
  }
}

export async function setCoverAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const albumId = String(formData.get("albumId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");

  try {
    await setAlbumCover(session, albumId, photoId);

    revalidatePath("/admin/albums");
    revalidatePath(`/admin/albums/${albumId}`);
    return { success: "Cover photo set." };
  } catch (error) {
    return toState(error, "setAlbumCover");
  }
}

export async function publishAlbumAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const albumId = String(formData.get("albumId") ?? "");

  // The publish card unmounts on success, so it cannot show its own message.
  // Same pattern as publishing an upload — outcome travels in the URL, and the
  // redirect sits outside the try/catch because Next signals it by throwing.
  let outcome: { total: number; reachable: number } | null = null;

  try {
    const result = await publishAlbum(session, albumId);

    await recordAudit({
      action: "album.published",
      targetType: "album",
      targetId: albumId,
      summary: `Published the album "${result.title}"`,
      metadata: { total: result.total, reachable: result.reachable },
      ...(await context(session)),
    });

    revalidatePath("/admin/albums");
    revalidatePath(`/admin/albums/${albumId}`);
    outcome = result;
  } catch (error) {
    return toState(error, "publishAlbum");
  }

  redirect(
    `/admin/albums/${albumId}?published=1&reachable=${outcome.reachable}&total=${outcome.total}`,
  );
}

export async function unpublishAlbumAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const albumId = String(formData.get("albumId") ?? "");

  try {
    await unpublishAlbum(session, albumId);

    revalidatePath("/admin/albums");
    revalidatePath(`/admin/albums/${albumId}`);
  } catch (error) {
    return toState(error, "unpublishAlbum");
  }

  redirect(`/admin/albums/${albumId}?withdrawn=1`);
}

export async function deleteAlbumAction(
  _prev: AlbumFormState,
  formData: FormData,
): Promise<AlbumFormState> {
  const session = await requireSessionOrThrow();
  const albumId = String(formData.get("albumId") ?? "");

  let title: string;

  try {
    const album = await deleteAlbum(session, albumId);
    revalidatePath("/admin/albums");
    title = album.title;
  } catch (error) {
    return toState(error, "deleteAlbum");
  }

  // The page this was submitted from no longer exists, so the outcome has to
  // survive the navigation.
  redirect(`/admin/albums?deleted=${encodeURIComponent(title)}`);
}
