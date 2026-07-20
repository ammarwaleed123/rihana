/**
 * Object storage, behind one interface.
 *
 * Two drivers implement this: S3Driver (Supabase Storage, R2, S3 — all speak the
 * S3 protocol) and LocalDriver (development fallback). Nothing outside
 * src/lib/storage/ imports a driver directly, so the deployment target is not
 * baked into the application.
 *
 * The interface is deliberately small. Photos are written once, read through
 * short-lived signed URLs, and deleted when a family asks to be erased. There is
 * no listing, no public URL, and no mutation in place.
 */

export type StorageObject = {
  key: string;
  size: number;
  contentType: string;
};

export interface StorageAdapter {
  /** Human-readable driver name, for logs and the health check. */
  readonly name: string;

  put(
    key: string,
    body: Buffer,
    options: { contentType: string; cacheControl?: string },
  ): Promise<StorageObject>;

  get(key: string): Promise<Buffer>;

  /**
   * A URL that grants read access to one object for a limited time.
   *
   * Always short-lived. The caller must have already checked that this person
   * may see this photo — minting a URL is the last step of an authorized
   * request, never a substitute for the check.
   */
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;

  delete(key: string): Promise<void>;

  /** Bulk delete for the erasure path. Missing keys are not an error. */
  deleteMany(keys: string[]): Promise<void>;

  exists(key: string): Promise<boolean>;
}

/**
 * Storage key layout.
 *
 * Keys are derived from ids, never from user-supplied filenames: an uploaded
 * name is attacker-controlled and belongs nowhere near a path. The variant is
 * part of the key so one photo's derivatives sit together and can be purged in
 * one prefix sweep.
 */
export type PhotoVariant = "original" | "web" | "thumb";

export function photoKey(photoId: string, variant: PhotoVariant): string {
  return `photos/${photoId}/${variant}.jpg`;
}

export function pickupPersonKey(
  pickupPersonId: string,
  variant: "photo" | "thumb",
): string {
  return `pickup/${pickupPersonId}/${variant}.jpg`;
}
