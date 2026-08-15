import "server-only";

import { env } from "@/lib/env";
import { LocalDriver } from "@/lib/storage/local-driver";
import { S3Driver } from "@/lib/storage/s3-driver";
import type { StorageAdapter } from "@/lib/storage/types";

/**
 * The storage adapter, selected by one environment variable.
 *
 * Callers import `storage` and never a driver, so swapping Supabase Storage for
 * R2 or S3 is a config change rather than a code change.
 */

let instance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!instance) {
    instance = env.STORAGE_DRIVER === "s3" ? new S3Driver() : new LocalDriver();
  }
  return instance;
}

export const storage: StorageAdapter = new Proxy({} as StorageAdapter, {
  get(_target, property) {
    return Reflect.get(getStorage(), property);
  },
});

export { photoKey, pickupPersonKey, signatureKey } from "@/lib/storage/types";
export type { StorageAdapter, PhotoVariant } from "@/lib/storage/types";
