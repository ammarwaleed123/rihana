import "server-only";

import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { env } from "@/lib/env";
import type { StorageAdapter, StorageObject } from "@/lib/storage/types";

/**
 * Development fallback. Writes to `.storage/` in the project root.
 *
 * Deliberately NOT inside `public/`: files there would be served directly by the
 * web server, with no authorization check in front of them. Everything here is
 * read back through the same signed-URL route as production, so the two
 * environments exercise the same code path.
 *
 * Environment validation refuses to start a production server on this driver.
 */
export class LocalDriver implements StorageAdapter {
  readonly name = "local";

  private readonly root = resolve(process.cwd(), ".storage");

  /**
   * Resolve a key to a path, refusing anything that escapes the root.
   *
   * Our keys are all derived from cuid2 ids, so traversal should be impossible
   * — but "should be impossible" is exactly the assumption path traversal bugs
   * are built on.
   */
  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error("Refusing to access a path outside the storage root");
    }
    return full;
  }

  async put(
    key: string,
    body: Buffer,
    options: { contentType: string },
  ): Promise<StorageObject> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);

    return { key, size: body.byteLength, contentType: options.contentType };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  /**
   * A signed path handled by our own route, not a real presigned URL.
   *
   * Same shape as production — an opaque, expiring token that grants one object
   * for a short window — so the calling code cannot tell the drivers apart.
   */
  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const signature = createHmac("sha256", env.SESSION_SECRET)
      .update(`${key}:${expiresAt}`)
      .digest("hex");

    const params = new URLSearchParams({
      key,
      expires: String(expiresAt),
      sig: signature,
    });

    return `/api/storage/local?${params.toString()}`;
  }

  /** Verify a local signed URL. Used only by the local-storage route handler. */
  static verify(key: string, expires: string, signature: string): boolean {
    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

    const expected = createHmac("sha256", env.SESSION_SECRET)
      .update(`${key}:${expiresAt}`)
      .digest("hex");

    // Lengths are fixed (hex sha256), so a plain comparison after a length check
    // is adequate here; this path never runs in production.
    return expected.length === signature.length && expected === signature;
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Absolute path for a key. Used by the local-storage route to stream bytes. */
  absolutePath(key: string): string {
    return join(this.root, key);
  }
}
