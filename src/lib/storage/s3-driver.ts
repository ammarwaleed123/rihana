import "server-only";

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";
import type { StorageAdapter, StorageObject } from "@/lib/storage/types";

/**
 * S3-protocol storage. Used with Supabase Storage in this deployment, but the
 * same code works against R2 or S3 itself.
 *
 * The bucket is private and never listable. Objects reach a browser only via
 * signedUrl(), always after an authorization check in the data layer.
 */
export class S3Driver implements StorageAdapter {
  readonly name = "s3";

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = env.S3_BUCKET!;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      // Required by Supabase Storage, MinIO and R2; harmless on real S3.
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }

  async put(
    key: string,
    body: Buffer,
    options: { contentType: string; cacheControl?: string },
  ): Promise<StorageObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        // Derivatives are immutable: a photo's thumbnail never changes, it is
        // only ever replaced by a new photo with a new id. Long cache lifetimes
        // are safe and are what keeps the CDN doing the work on album-drop day.
        CacheControl: options.cacheControl ?? "private, max-age=31536000, immutable",
        // Stops any chance of the object being interpreted as a document if it
        // is ever fetched directly.
        ContentDisposition: "inline",
      }),
    );

    return { key, size: body.byteLength, contentType: options.contentType };
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object at ${key}`);

    return Buffer.from(bytes);
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    // The API caps a batch at 1000 keys.
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
