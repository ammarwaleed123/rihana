import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { processUpload, UnsupportedImageError } from "@/lib/images/process";
import { QUEUES, enqueue } from "@/lib/jobs/queue";
import { assertCanManageClass, classIdsForTeacher } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { photoKey, storage } from "@/lib/storage";

/**
 * Photo ingestion and tagging.
 *
 * The upload request does only what cannot be deferred: validate, re-encode,
 * write to storage, insert a row. Thumbnails and notification fan-out are
 * queued, which is what allows an upload of 200 photos to return without
 * timing out.
 */

export type UploadOutcome = {
  uploadSessionId: string;
  accepted: number;
  rejected: Array<{ filename: string; reason: string }>;
};

/** Staff may only upload into a class they are responsible for. */
async function assertCanUploadTo(session: Session, classId: string) {
  if (session.user.role === "PARENT") throw new ForbiddenError();
  await assertCanManageClass(session, classId);
}

export async function createUploadSession(session: Session, classId: string) {
  await assertCanUploadTo(session, classId);

  return prisma.uploadSession.create({
    data: {
      uploaderUserId: session.user.id,
      classId,
      status: "DRAFT",
    },
    select: { id: true },
  });
}

/**
 * Ingest one batch of files into an upload session.
 *
 * Files are handled independently: one unreadable photo among two hundred is
 * reported and skipped, not a reason to fail the whole batch.
 */
export async function ingestPhotos(
  session: Session,
  uploadSessionId: string,
  files: File[],
): Promise<UploadOutcome> {
  const uploadSession = await prisma.uploadSession.findUnique({
    where: { id: uploadSessionId },
    select: { id: true, classId: true, uploaderUserId: true, status: true },
  });

  if (!uploadSession?.classId) throw new NotFoundError();
  await assertCanUploadTo(session, uploadSession.classId);

  if (uploadSession.status === "PUBLISHED") {
    throw new ForbiddenError("This upload has already been published.");
  }

  if (files.length > env.MAX_UPLOAD_FILES_PER_BATCH) {
    throw new ForbiddenError(
      `Please upload at most ${env.MAX_UPLOAD_FILES_PER_BATCH} photos at a time.`,
    );
  }

  const rejected: Array<{ filename: string; reason: string }> = [];
  const acceptedPhotoIds: string[] = [];

  for (const file of files) {
    const filename = file.name || "photo";

    // Size is checked before reading the body into memory.
    if (file.size > env.MAX_UPLOAD_BYTES) {
      rejected.push({
        filename,
        reason: `Larger than ${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
      });
      continue;
    }

    try {
      const raw = Buffer.from(await file.arrayBuffer());

      // Sniffs magic bytes, strips all metadata, re-encodes. The stored bytes
      // are sharp's output, never the uploader's.
      const processed = await processUpload(raw);

      // Duplicate within this batch — the same photo dragged in twice.
      const duplicate = await prisma.photo.findUnique({
        where: {
          uploadSessionId_checksumSha256: {
            uploadSessionId,
            checksumSha256: processed.checksumSha256,
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        rejected.push({ filename, reason: "Already in this upload" });
        continue;
      }

      const photo = await prisma.photo.create({
        data: {
          uploadSessionId,
          uploadedByUserId: session.user.id,
          classId: uploadSession.classId,
          storageKeyOriginal: "",
          mimeType: "image/jpeg",
          byteSize: processed.original.byteSize,
          width: processed.original.width,
          height: processed.original.height,
          checksumSha256: processed.checksumSha256,
          status: "PROCESSING",
        },
        select: { id: true },
      });

      const originalKey = photoKey(photo.id, "original");
      const webKey = photoKey(photo.id, "web");

      await Promise.all([
        storage.put(originalKey, processed.original.buffer, {
          contentType: "image/jpeg",
        }),
        storage.put(webKey, processed.web.buffer, { contentType: "image/jpeg" }),
      ]);

      await prisma.photo.update({
        where: { id: photo.id },
        data: { storageKeyOriginal: originalKey, storageKeyWeb: webKey },
      });

      acceptedPhotoIds.push(photo.id);
    } catch (error) {
      const reason =
        error instanceof UnsupportedImageError
          ? error.message
          : "Could not be processed";

      logger.warn(
        { scope: "ingest", filename, err: (error as Error).message },
        "photo rejected",
      );
      rejected.push({ filename, reason });
    }
  }

  await prisma.uploadSession.update({
    where: { id: uploadSessionId },
    data: {
      photoCount: await prisma.photo.count({ where: { uploadSessionId } }),
      status: "DRAFT",
    },
  });

  // Enqueued together, after every file is safely stored, rather than one at a
  // time inside the loop. Two hundred photos would otherwise mean two hundred
  // sequential round trips to the queue on a request someone is waiting on —
  // and each `enqueue` is individually time-bounded and non-throwing, so a slow
  // or unavailable queue delays nothing. Photos left in PROCESSING are picked
  // up later rather than lost.
  await Promise.allSettled(
    acceptedPhotoIds.map((photoId) =>
      enqueue(QUEUES.photoProcess, { photoId }),
    ),
  );

  return { uploadSessionId, accepted: acceptedPhotoIds.length, rejected };
}

// ---------------------------------------------------------------------------
// Tagging
// ---------------------------------------------------------------------------

/**
 * Set exactly which children appear in a photo.
 *
 * Replaces the whole tag set rather than adding to it, so unchecking a child in
 * the UI actually revokes their family's access.
 *
 * A child without photo consent cannot be tagged at all — enforced here, not in
 * the UI, because that is a legal permission and not a display preference.
 */
export async function setPhotoTags(
  session: Session,
  photoId: string,
  childIds: string[],
): Promise<{ tagged: number; skippedNoConsent: string[] }> {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, classId: true, createdAt: true, deletedAt: true },
  });

  if (!photo || photo.deletedAt || !photo.classId) throw new NotFoundError();
  await assertCanUploadTo(session, photo.classId);

  // Every child must be in this photo's class. Tagging across classes would put
  // a photo into an album whose parents never consented to it.
  const children = await prisma.child.findMany({
    where: {
      id: { in: childIds },
      classId: photo.classId,
      deletedAt: null,
      status: "ACTIVE",
    },
    select: { id: true, firstName: true, lastName: true, photoConsent: true },
  });

  const allowed = children.filter((c) => c.photoConsent);
  const skippedNoConsent = children
    .filter((c) => !c.photoConsent)
    .map((c) => `${c.firstName} ${c.lastName}`);

  await prisma.$transaction([
    prisma.photoTag.deleteMany({ where: { photoId } }),
    prisma.photoTag.createMany({
      data: allowed.map((child) => ({
        photoId,
        childId: child.id,
        taggedByUserId: session.user.id,
        // Denormalised so a parent's album paginates off the covering index
        // photo_tags(childId, photoCreatedAt DESC) with no join.
        photoCreatedAt: photo.createdAt,
      })),
      skipDuplicates: true,
    }),
  ]);

  return { tagged: allowed.length, skippedNoConsent };
}

/** Mark a photo as a class-album photo, or back to tagged-only. */
export async function setPhotoVisibility(
  session: Session,
  photoId: string,
  visibility: "TAGGED_ONLY" | "CLASS_ALBUM",
) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, classId: true, deletedAt: true },
  });

  if (!photo || photo.deletedAt || !photo.classId) throw new NotFoundError();
  await assertCanUploadTo(session, photo.classId);

  await prisma.photo.update({ where: { id: photoId }, data: { visibility } });
  return photo;
}

export async function setPhotoCaption(
  session: Session,
  photoId: string,
  caption: string,
) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, classId: true, deletedAt: true },
  });

  if (!photo || photo.deletedAt || !photo.classId) throw new NotFoundError();
  await assertCanUploadTo(session, photo.classId);

  await prisma.photo.update({
    where: { id: photoId },
    data: { caption: caption.trim().slice(0, 300) || null },
  });
}

/**
 * Publish an upload session.
 *
 * This is the moment photos become visible to families, and the moment one
 * notification per affected parent is queued — one per publish event, never one
 * per photo.
 *
 * Photos with neither tags nor class-album visibility are left unpublished:
 * they would reach nobody, and silently publishing them into the void hides a
 * tagging mistake.
 */
export async function publishUploadSession(
  session: Session,
  uploadSessionId: string,
) {
  const uploadSession = await prisma.uploadSession.findUnique({
    where: { id: uploadSessionId },
    select: { id: true, classId: true, status: true },
  });

  if (!uploadSession?.classId) throw new NotFoundError();
  await assertCanUploadTo(session, uploadSession.classId);

  if (uploadSession.status === "PUBLISHED") {
    throw new ForbiddenError("This upload has already been published.");
  }

  const publishable = await prisma.photo.findMany({
    where: {
      uploadSessionId,
      deletedAt: null,
      status: { in: ["READY", "PROCESSING"] },
      OR: [{ tags: { some: {} } }, { visibility: "CLASS_ALBUM" }],
    },
    select: { id: true },
  });

  const unreachable = await prisma.photo.count({
    where: {
      uploadSessionId,
      deletedAt: null,
      tags: { none: {} },
      visibility: "TAGGED_ONLY",
    },
  });

  const publishedAt = new Date();

  await prisma.$transaction([
    prisma.photo.updateMany({
      where: { id: { in: publishable.map((p) => p.id) } },
      data: { publishedAt },
    }),
    prisma.uploadSession.update({
      where: { id: uploadSessionId },
      data: { status: "PUBLISHED", publishedAt },
    }),
  ]);

  // Fan-out is queued, not inline: it touches every affected family and must not
  // sit inside the request that publishes.
  await enqueue(QUEUES.notifyPhotosPublished, { uploadSessionId });

  return { published: publishable.length, unreachable };
}

/** Delete a photo and queue its objects for removal from storage. */
export async function deletePhoto(session: Session, photoId: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      classId: true,
      storageKeyOriginal: true,
      storageKeyWeb: true,
      storageKeyThumb: true,
    },
  });

  if (!photo?.classId) throw new NotFoundError();
  await assertCanUploadTo(session, photo.classId);

  await prisma.$transaction([
    prisma.photoTag.deleteMany({ where: { photoId } }),
    prisma.albumPhoto.deleteMany({ where: { photoId } }),
    prisma.photo.delete({ where: { id: photoId } }),
  ]);

  const keys = [
    photo.storageKeyOriginal,
    photo.storageKeyWeb,
    photo.storageKeyThumb,
  ].filter((k): k is string => Boolean(k));

  await enqueue(QUEUES.storagePurge, { keys });

  return photo;
}

/** Children who may be tagged in a class's photos, for the tagging UI. */
export async function getTaggableChildren(session: Session, classId: string) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  if (session.user.role === "TEACHER") {
    const classIds = await classIdsForTeacher(session.user.id);
    if (!classIds.includes(classId)) throw new NotFoundError();
  }

  return prisma.child.findMany({
    where: { classId, deletedAt: null, status: "ACTIVE" },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoConsent: true,
    },
  });
}
