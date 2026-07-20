import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { LocalDriver } from "@/lib/storage/local-driver";

/**
 * Serves objects for the local development storage driver.
 *
 * Production never reaches this: with STORAGE_DRIVER=s3 the signed URL points
 * straight at the bucket, and environment validation refuses to start a
 * production server on the local driver. This exists so that development
 * exercises the same "authorize, then redirect to a signed URL" path as
 * production rather than a shortcut that hides bugs.
 *
 * Authorization already happened in /api/img — this route only verifies the
 * signature and expiry it issued.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (env.STORAGE_DRIVER !== "local") {
    return new NextResponse(null, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const key = params.get("key");
  const expires = params.get("expires");
  const signature = params.get("sig");

  if (!key || !expires || !signature) {
    return new NextResponse(null, { status: 404 });
  }

  if (!LocalDriver.verify(key, expires, signature)) {
    // Covers both a tampered signature and an expired link.
    return new NextResponse(null, { status: 404 });
  }

  try {
    const driver = new LocalDriver();
    const path = driver.absolutePath(key);
    const info = await stat(path);

    const stream = Readable.toWeb(
      createReadStream(path),
    ) as unknown as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(info.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noimageindex",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
