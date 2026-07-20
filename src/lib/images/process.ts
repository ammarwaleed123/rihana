import "server-only";

import { createHash } from "node:crypto";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import type { Sharp } from "sharp";

/**
 * Image ingestion.
 *
 * The rule that matters: the bytes we store are produced by sharp, not by the
 * uploader. Re-encoding is what actually defuses a malicious file — a polyglot
 * that is simultaneously a valid JPEG and a valid script stops being both the
 * moment it is decoded to a pixel buffer and written out fresh.
 *
 * Everything else here supports that:
 *   - Content type is decided by magic bytes, never by the filename or the
 *     client-supplied Content-Type, both of which the uploader controls.
 *   - All metadata is dropped, which is how GPS coordinates in a phone photo
 *     stop being a record of where a child was.
 *   - Anything sharp cannot decode is rejected rather than stored.
 */

/**
 * Formats we accept. HEIC is what modern iPhones produce and parents will upload
 * it constantly; it is transcoded to JPEG like everything else.
 */
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/gif",
]);

/** Guard against decompression bombs: a small file that expands to gigapixels. */
const MAX_PIXELS = 60_000_000;

export type Variant = {
  buffer: Buffer;
  width: number;
  height: number;
  byteSize: number;
};

export type ProcessedImage = {
  original: Variant;
  web: Variant;
  checksumSha256: string;
  /** The format actually detected, for logging — not the stored format. */
  detectedMimeType: string;
};

export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedImageError";
  }
}

/**
 * Identify a buffer by its magic bytes.
 *
 * A file called `photo.jpg` proves nothing, and neither does a multipart part
 * claiming `Content-Type: image/jpeg`. Both are supplied by whoever is
 * uploading.
 */
export async function sniffMimeType(buffer: Buffer): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer);
  return detected?.mime ?? null;
}

export async function assertSupportedImage(buffer: Buffer): Promise<string> {
  const mime = await sniffMimeType(buffer);

  if (!mime) {
    throw new UnsupportedImageError(
      "That file does not look like an image. Please upload a photo.",
    );
  }

  if (!ACCEPTED_MIME_TYPES.has(mime)) {
    throw new UnsupportedImageError(
      `${mime} files are not supported. Please upload a JPEG, PNG, HEIC or WebP photo.`,
    );
  }

  return mime;
}

/**
 * Decode, strip, re-encode.
 *
 * Two variants are produced synchronously because both are needed before a photo
 * can be shown at all. The thumbnail is generated in the background worker,
 * since nothing blocks on it.
 */
export async function processUpload(buffer: Buffer): Promise<ProcessedImage> {
  const detectedMimeType = await assertSupportedImage(buffer);

  // `limitInputPixels` is the decompression-bomb guard; `failOn: "truncated"`
  // accepts mildly malformed files that browsers would render anyway, rather
  // than rejecting a parent's slightly-corrupt phone photo.
  const pipeline = () =>
    sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "truncated" });

  let metadata;
  try {
    metadata = await pipeline().metadata();
  } catch (error) {
    throw new UnsupportedImageError(
      `That image could not be read: ${(error as Error).message}`,
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new UnsupportedImageError("That image has no readable dimensions.");
  }

  const original = await encode(pipeline(), { maxEdge: 2560, quality: 86 });
  const web = await encode(pipeline(), { maxEdge: 1280, quality: 82 });

  return {
    original,
    web,
    // Checksum of the re-encoded bytes, not the upload: it identifies what we
    // actually stored, and makes duplicate detection within a batch meaningful.
    checksumSha256: createHash("sha256").update(original.buffer).digest("hex"),
    detectedMimeType,
  };
}

/** Thumbnail. Generated in the worker, not on the upload request. */
export async function createThumbnail(buffer: Buffer): Promise<Variant> {
  return encode(
    sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "truncated" }),
    { maxEdge: 400, quality: 74 },
  );
}

async function encode(
  pipeline: Sharp,
  options: { maxEdge: number; quality: number },
): Promise<Variant> {
  const { data, info } = await pipeline
    // Honour the EXIF orientation flag before stripping metadata, otherwise
    // portrait phone photos come out sideways.
    .rotate()
    .resize({
      width: options.maxEdge,
      height: options.maxEdge,
      fit: "inside",
      // Never upscale: a small photo stays small rather than becoming a blurry
      // large one.
      withoutEnlargement: true,
    })
    // No .withMetadata() call anywhere in this file. That is the point: sharp
    // drops EXIF, IPTC, XMP and ICC by default, so GPS coordinates, camera
    // serial numbers and timestamps never reach storage. Adding
    // `.withMetadata()` here would silently reintroduce all of it.
    .jpeg({ quality: options.quality, progressive: true, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    byteSize: data.byteLength,
  };
}

/**
 * Read back whatever metadata a buffer still carries.
 *
 * Used by the security tests to prove stripping worked, rather than trusting
 * that it did.
 */
export async function readMetadata(buffer: Buffer) {
  const meta = await sharp(buffer).metadata();
  return {
    format: meta.format,
    width: meta.width,
    height: meta.height,
    hasExif: Boolean(meta.exif),
    hasIcc: Boolean(meta.icc),
    hasIptc: Boolean(meta.iptc),
    hasXmp: Boolean(meta.xmp),
  };
}
