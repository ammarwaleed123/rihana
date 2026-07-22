"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { recordAudit } from "@/lib/data/audit";
import {
  createUploadSession,
  deletePhoto,
  discardUploadSession,
  ingestPhotos,
  publishUploadSession,
  setPhotoCaption,
  setPhotoTags,
  setPhotoVisibility,
  unpublishUploadSession,
} from "@/lib/data/uploads";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { cuid, readAll } from "@/lib/validation";

export type PhotoFormState = {
  error?: string;
  success?: string;
  rejected?: Array<{ filename: string; reason: string }>;
};

async function context(session: Session) {
  const headerList = await headers();
  return {
    actor: { id: session.user.id, role: session.user.role },
    ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
  };
}

function toState(error: unknown, scope: string): PhotoFormState {
  if (error instanceof ForbiddenError) return { error: error.message };
  if (error instanceof NotFoundError) return { error: "That item no longer exists." };

  logger.error({ err: error, scope }, "photo action failed");
  return { error: "Something went wrong. Please try again." };
}

/**
 * Start an upload and ingest the first batch.
 *
 * Redirects to the tagging screen on success — an upload is only half done
 * until the photos are tagged, and dropping the admin back on an empty form
 * would make it easy to walk away mid-way.
 */
/**
 * Create an empty upload session.
 *
 * Separate from ingestion so the client can then send files in batches. A
 * request carrying every photo at once would blow past any sane body limit —
 * two hundred photos is gigabytes — so the batching lives in the browser and
 * each batch is its own request.
 */
export async function startUploadAction(
  classId: string,
): Promise<{ uploadSessionId?: string; error?: string }> {
  const session = await requireSessionOrThrow();

  if (!cuid.safeParse(classId).success) {
    return { error: "Choose a class to upload into." };
  }

  try {
    const created = await createUploadSession(session, classId);
    return { uploadSessionId: created.id };
  } catch (error) {
    return { error: toState(error, "startUpload").error };
  }
}

/** Ingest one batch of files into an existing session. */
export async function uploadBatchAction(
  formData: FormData,
): Promise<{
  accepted: number;
  rejected: Array<{ filename: string; reason: string }>;
  error?: string;
}> {
  const session = await requireSessionOrThrow();
  const uploadSessionId = String(formData.get("uploadSessionId") ?? "");

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) return { accepted: 0, rejected: [] };

  try {
    const outcome = await ingestPhotos(session, uploadSessionId, files);
    return { accepted: outcome.accepted, rejected: outcome.rejected };
  } catch (error) {
    return {
      accepted: 0,
      rejected: [],
      error: toState(error, "uploadBatch").error,
    };
  }
}

/** Discard an upload session that ended up with nothing usable in it. */
export async function discardUploadAction(
  uploadSessionId: string,
): Promise<void> {
  const session = await requireSessionOrThrow();

  try {
    await discardUploadSession(session, uploadSessionId);
    revalidatePath("/admin/photos");
  } catch (error) {
    logger.warn({ err: error, scope: "discardUpload" }, "could not discard");
  }
}

/**
 * Withdraw a published upload from the family portal.
 *
 * Publishing was previously one-way, which left no way to undo sharing the
 * wrong photo. Owner-only.
 */
export async function unpublishAction(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const session = await requireSessionOrThrow();
  const uploadSessionId = String(formData.get("uploadSessionId") ?? "");

  /*
   * Third time this shape has appeared, so worth stating: a form that removes
   * itself on success cannot display its own success message. The withdraw card
   * only renders while the upload is published, so it unmounts the instant this
   * succeeds. Same for publish, and for deleting a child. The outcome travels in
   * the URL instead, and the redirect sits outside the try/catch because Next
   * signals redirects by throwing.
   */
  let withdrawn: number | null = null;

  try {
    const result = await unpublishUploadSession(session, uploadSessionId);

    await recordAudit({
      action: "photo.published",
      targetType: "upload_session",
      targetId: uploadSessionId,
      summary: `Withdrew ${result.withdrawn} photo(s) from families`,
      metadata: { withdrawn: result.withdrawn, direction: "unpublish" },
      ...(await context(session)),
    });

    revalidatePath("/admin/photos");
    revalidatePath(`/admin/photos/${uploadSessionId}`);
    withdrawn = result.withdrawn;
  } catch (error) {
    return toState(error, "unpublish");
  }

  redirect(`/admin/photos/${uploadSessionId}?withdrawn=${withdrawn}`);
}

/** Add more photos to an existing, unpublished upload. */
export async function addPhotosAction(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const session = await requireSessionOrThrow();
  const uploadSessionId = String(formData.get("uploadSessionId") ?? "");

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) return { error: "Choose at least one photo." };

  try {
    const outcome = await ingestPhotos(session, uploadSessionId, files);

    revalidatePath(`/admin/photos/${uploadSessionId}`);
    return {
      success: `Added ${outcome.accepted} photo${outcome.accepted === 1 ? "" : "s"}.`,
      rejected: outcome.rejected.length > 0 ? outcome.rejected : undefined,
    };
  } catch (error) {
    return toState(error, "addPhotos");
  }
}

const tagsInput = z.object({
  photoId: cuid,
  uploadSessionId: cuid,
  childIds: z.array(cuid).max(60),
});

export async function setTagsAction(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const session = await requireSessionOrThrow();

  const parsed = tagsInput.safeParse({
    photoId: formData.get("photoId"),
    uploadSessionId: formData.get("uploadSessionId"),
    childIds: readAll(formData, "childIds"),
  });

  if (!parsed.success) return { error: "Could not save those tags." };

  try {
    const result = await setPhotoTags(
      session,
      parsed.data.photoId,
      parsed.data.childIds,
    );

    await recordAudit({
      action: "photo.tagged",
      targetType: "photo",
      targetId: parsed.data.photoId,
      summary: `Tagged ${result.tagged} child${result.tagged === 1 ? "" : "ren"} in a photo`,
      metadata: { childIds: parsed.data.childIds },
      ...(await context(session)),
    });

    revalidatePath(`/admin/photos/${parsed.data.uploadSessionId}`);

    // Surfaced rather than silently dropped: staff need to know a child was
    // left out, and why.
    if (result.skippedNoConsent.length > 0) {
      return {
        success: `Saved. ${result.skippedNoConsent.join(", ")} could not be tagged — photo consent has been withdrawn.`,
      };
    }

    return { success: "Tags saved." };
  } catch (error) {
    return toState(error, "setTags");
  }
}

export async function setVisibilityAction(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const session = await requireSessionOrThrow();
  const photoId = String(formData.get("photoId") ?? "");
  const uploadSessionId = String(formData.get("uploadSessionId") ?? "");
  const visibility =
    formData.get("visibility") === "CLASS_ALBUM" ? "CLASS_ALBUM" : "TAGGED_ONLY";

  try {
    await setPhotoVisibility(session, photoId, visibility);
    revalidatePath(`/admin/photos/${uploadSessionId}`);
    return {
      success:
        visibility === "CLASS_ALBUM"
          ? "Shared with the whole class."
          : "Now visible only to tagged children's families.",
    };
  } catch (error) {
    return toState(error, "setVisibility");
  }
}

export async function setCaptionAction(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const session = await requireSessionOrThrow();
  const photoId = String(formData.get("photoId") ?? "");
  const uploadSessionId = String(formData.get("uploadSessionId") ?? "");

  try {
    await setPhotoCaption(session, photoId, String(formData.get("caption") ?? ""));
    revalidatePath(`/admin/photos/${uploadSessionId}`);
    return { success: "Caption saved." };
  } catch (error) {
    return toState(error, "setCaption");
  }
}

export async function deletePhotoAction(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const session = await requireSessionOrThrow();
  const photoId = String(formData.get("photoId") ?? "");
  const uploadSessionId = String(formData.get("uploadSessionId") ?? "");

  try {
    await deletePhoto(session, photoId);

    await recordAudit({
      action: "photo.deleted",
      targetType: "photo",
      targetId: photoId,
      summary: "Deleted a photo",
      ...(await context(session)),
    });

    revalidatePath(`/admin/photos/${uploadSessionId}`);
    return { success: "Photo deleted." };
  } catch (error) {
    return toState(error, "deletePhoto");
  }
}

export async function publishAction(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const session = await requireSessionOrThrow();
  const uploadSessionId = String(formData.get("uploadSessionId") ?? "");

  // Publishing removes the form this action was submitted from — the publish
  // card only renders while the upload is unpublished — so a returned success
  // message would be unmounted before anyone read it. The outcome is carried in
  // the URL instead, and the redirect happens outside the try/catch because
  // Next signals redirects by throwing.
  let outcome: { published: number; unreachable: number } | null = null;

  try {
    const result = await publishUploadSession(session, uploadSessionId);

    await recordAudit({
      action: "photo.published",
      targetType: "upload_session",
      targetId: uploadSessionId,
      summary: `Published ${result.published} photo${result.published === 1 ? "" : "s"} to families`,
      metadata: { published: result.published, unreachable: result.unreachable },
      ...(await context(session)),
    });

    revalidatePath("/admin/photos");
    revalidatePath(`/admin/photos/${uploadSessionId}`);
    outcome = result;
  } catch (error) {
    return toState(error, "publish");
  }

  redirect(
    `/admin/photos/${uploadSessionId}?published=${outcome.published}&unreachable=${outcome.unreachable}`,
  );
}
