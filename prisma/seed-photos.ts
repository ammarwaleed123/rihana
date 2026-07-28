import { readFile } from "node:fs/promises";
import path from "node:path";

import { createThumbnail, processUpload } from "@/lib/images/process";
import { photoKey, storage } from "@/lib/storage";
import type { PrismaClient } from "../src/generated/prisma/client.js";

/**
 * Demo photos for the owner's click-through demo.
 *
 * This is throwaway demo data. Production starts empty — the nursery adds real
 * photos through the admin UI — and the e2e reset never runs this. It exists
 * only so the owner sees a populated portal (latest photos, albums, and the
 * photo→family routing that is flagship A) before entering any real data.
 *
 * It replays the real ingest pipeline rather than faking rows: every image is
 * decoded, stripped of all metadata and re-encoded by sharp (see
 * src/lib/images/process.ts), the three variants are written to the same object
 * storage the app serves from, and the records are published exactly as a real
 * upload would be. That fidelity is the point — the demo shows the real system,
 * not a mock. The thumbnail, normally a worker job, is generated inline so the
 * demo is complete without the worker running.
 *
 * Because it touches storage + sharp (both server-only), this module runs under
 * the worker tsconfig; see prisma/seed-demo.ts. It is idempotent: deterministic
 * ids mean a re-run overwrites the same storage objects and upserts the same
 * rows rather than piling up duplicates.
 */

type SeedContext = {
  classIds: { sunflowers: string; olives: string };
  uploaderIds: { sunflowers: string; olives: string };
  ownerId: string;
  childIdByName: Record<string, string>;
};

type PhotoSpec = {
  id: string;
  file: string;
  caption: string;
  /** Class-album photo (whole class sees it) vs. tagged-only. */
  classAlbum: boolean;
  /** First names of children to tag; each must be in the photo's class. */
  tag: string[];
};

const MARKETING_DIR = path.join(process.cwd(), "public", "marketing");

// Distinct image per photo: the checksum is unique within an upload session, so
// no two photos in one session may share bytes. Reuses the marketing photos —
// generic nursery activity shots, not real enrolled children — as demo content.
const SUNFLOWER_PHOTOS: PhotoSpec[] = [
  { id: "seedphoto-sun-reading", file: "reading.jpg", caption: "Story time in the reading corner", classAlbum: true, tag: [] },
  { id: "seedphoto-sun-art", file: "art.jpg", caption: "Laila's masterpiece", classAlbum: false, tag: ["Laila"] },
  { id: "seedphoto-sun-music", file: "music.jpg", caption: "Shakers and singing", classAlbum: false, tag: ["Zayn", "Tariq"] },
  { id: "seedphoto-sun-play", file: "play.jpg", caption: "Building towers together", classAlbum: true, tag: [] },
];

const OLIVE_PHOTOS: PhotoSpec[] = [
  { id: "seedphoto-oli-movement", file: "movement.jpg", caption: "Morning stretches", classAlbum: true, tag: [] },
  { id: "seedphoto-oli-calm", file: "calm.jpg", caption: "Quiet time for Hana", classAlbum: false, tag: ["Hana"] },
  { id: "seedphoto-oli-care", file: "care.jpg", caption: "Snack helpers", classAlbum: false, tag: ["Omar", "Maya"] },
  { id: "seedphoto-oli-hero", file: "hero.jpg", caption: "Outdoor adventures", classAlbum: true, tag: [] },
];

export async function seedPhotos(prisma: PrismaClient, ctx: SeedContext) {
  const now = new Date();
  console.log("[seed] photos: re-encoding demo images and writing to storage…");

  const sunSession = await upsertSession(
    prisma,
    "seedsession-sunflowers",
    ctx.uploaderIds.sunflowers,
    ctx.classIds.sunflowers,
    now,
  );
  const oliSession = await upsertSession(
    prisma,
    "seedsession-olives",
    ctx.uploaderIds.olives,
    ctx.classIds.olives,
    now,
  );

  await seedInto(prisma, ctx, {
    sessionId: sunSession,
    classId: ctx.classIds.sunflowers,
    uploaderId: ctx.uploaderIds.sunflowers,
    photos: SUNFLOWER_PHOTOS,
    now,
  });
  await seedInto(prisma, ctx, {
    sessionId: oliSession,
    classId: ctx.classIds.olives,
    uploaderId: ctx.uploaderIds.olives,
    photos: OLIVE_PHOTOS,
    now,
  });

  await prisma.uploadSession.update({
    where: { id: sunSession },
    data: { photoCount: SUNFLOWER_PHOTOS.length },
  });
  await prisma.uploadSession.update({
    where: { id: oliSession },
    data: { photoCount: OLIVE_PHOTOS.length },
  });

  // Albums. Membership never widens access (see rihana-invariants): a family
  // sees only the subset of an album's photos it is already entitled to, so the
  // whole-nursery album below shows each parent just their own class's photos.
  await upsertAlbum(prisma, {
    id: "seedalbum-sunflowers",
    title: "Sunflowers — This Week",
    description: "A few moments from the Sunflowers room.",
    classId: ctx.classIds.sunflowers,
    coverPhotoId: "seedphoto-sun-art",
    createdByUserId: ctx.ownerId,
    photoIds: SUNFLOWER_PHOTOS.map((p) => p.id),
    now,
  });
  await upsertAlbum(prisma, {
    id: "seedalbum-nursery",
    title: "A Day at Rihana",
    description: "Highlights from across the nursery.",
    classId: null,
    coverPhotoId: "seedphoto-oli-hero",
    createdByUserId: ctx.ownerId,
    photoIds: ["seedphoto-sun-reading", "seedphoto-sun-play", "seedphoto-oli-movement", "seedphoto-oli-hero"],
    now,
  });

  console.log(
    `[seed] photos: ${SUNFLOWER_PHOTOS.length + OLIVE_PHOTOS.length} published across 2 classes and 2 albums.`,
  );
}

async function upsertSession(
  prisma: PrismaClient,
  id: string,
  uploaderUserId: string,
  classId: string,
  now: Date,
): Promise<string> {
  await prisma.uploadSession.upsert({
    where: { id },
    update: { status: "PUBLISHED", publishedAt: now },
    create: { id, uploaderUserId, classId, status: "PUBLISHED", publishedAt: now },
  });
  return id;
}

async function seedInto(
  prisma: PrismaClient,
  ctx: SeedContext,
  opts: {
    sessionId: string;
    classId: string;
    uploaderId: string;
    photos: PhotoSpec[];
    now: Date;
  },
) {
  for (const spec of opts.photos) {
    const buffer = await readFile(path.join(MARKETING_DIR, spec.file));

    // Same path a real upload takes: sniff, strip metadata, re-encode.
    const processed = await processUpload(buffer);
    const thumb = await createThumbnail(processed.original.buffer);

    const originalKey = photoKey(spec.id, "original");
    const webKey = photoKey(spec.id, "web");
    const thumbKey = photoKey(spec.id, "thumb");

    await Promise.all([
      storage.put(originalKey, processed.original.buffer, { contentType: "image/jpeg" }),
      storage.put(webKey, processed.web.buffer, { contentType: "image/jpeg" }),
      storage.put(thumbKey, thumb.buffer, { contentType: "image/jpeg" }),
    ]);

    await prisma.photo.upsert({
      where: { id: spec.id },
      create: {
        id: spec.id,
        createdAt: opts.now,
        uploadSessionId: opts.sessionId,
        uploadedByUserId: opts.uploaderId,
        classId: opts.classId,
        storageKeyOriginal: originalKey,
        storageKeyWeb: webKey,
        storageKeyThumb: thumbKey,
        mimeType: "image/jpeg",
        byteSize: processed.original.byteSize,
        width: processed.original.width,
        height: processed.original.height,
        checksumSha256: processed.checksumSha256,
        visibility: spec.classAlbum ? "CLASS_ALBUM" : "TAGGED_ONLY",
        status: "READY",
        caption: spec.caption,
        publishedAt: opts.now,
      },
      update: {
        storageKeyOriginal: originalKey,
        storageKeyWeb: webKey,
        storageKeyThumb: thumbKey,
        byteSize: processed.original.byteSize,
        width: processed.original.width,
        height: processed.original.height,
        checksumSha256: processed.checksumSha256,
        visibility: spec.classAlbum ? "CLASS_ALBUM" : "TAGGED_ONLY",
        status: "READY",
        caption: spec.caption,
        publishedAt: opts.now,
      },
    });

    // Replace the tag set idempotently: drop any tag not wanted now, add the
    // rest. photoCreatedAt is denormalised so a parent's album paginates off the
    // covering index with no join (see the PhotoTag model).
    const childIds = spec.tag
      .map((name) => ctx.childIdByName[name])
      .filter((id): id is string => Boolean(id));

    await prisma.photoTag.deleteMany({
      where: {
        photoId: spec.id,
        ...(childIds.length ? { childId: { notIn: childIds } } : {}),
      },
    });

    for (const childId of childIds) {
      await prisma.photoTag.upsert({
        where: { photoId_childId: { photoId: spec.id, childId } },
        update: { photoCreatedAt: opts.now },
        create: {
          photoId: spec.id,
          childId,
          taggedByUserId: opts.uploaderId,
          photoCreatedAt: opts.now,
        },
      });
    }
  }
}

async function upsertAlbum(
  prisma: PrismaClient,
  opts: {
    id: string;
    title: string;
    description: string;
    classId: string | null;
    coverPhotoId: string;
    createdByUserId: string;
    photoIds: string[];
    now: Date;
  },
) {
  await prisma.album.upsert({
    where: { id: opts.id },
    create: {
      id: opts.id,
      title: opts.title,
      description: opts.description,
      classId: opts.classId,
      coverPhotoId: opts.coverPhotoId,
      status: "PUBLISHED",
      publishedAt: opts.now,
      createdByUserId: opts.createdByUserId,
      createdAt: opts.now,
    },
    update: {
      title: opts.title,
      description: opts.description,
      classId: opts.classId,
      coverPhotoId: opts.coverPhotoId,
      status: "PUBLISHED",
      publishedAt: opts.now,
    },
  });

  await prisma.albumPhoto.deleteMany({
    where: { albumId: opts.id, photoId: { notIn: opts.photoIds } },
  });

  let sortOrder = 0;
  for (const photoId of opts.photoIds) {
    await prisma.albumPhoto.upsert({
      where: { albumId_photoId: { albumId: opts.id, photoId } },
      update: { sortOrder },
      create: { albumId: opts.id, photoId, sortOrder },
    });
    sortOrder += 1;
  }
}
