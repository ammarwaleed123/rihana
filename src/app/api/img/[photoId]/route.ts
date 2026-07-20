import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/scope";
import { getPhotoForUser } from "@/lib/data/photos";
import { env } from "@/lib/env";
import { reportError } from "@/lib/logger";
import { getStorage } from "@/lib/storage";

/**
 * GET /api/img/<photoId>?v=thumb|web|original
 *
 * The single door in front of every image byte in this system.
 *
 * Order matters and is not negotiable:
 *   1. Authenticate.
 *   2. Ask the data layer whether this person may see this photo.
 *   3. Only then mint a short-lived signed URL and redirect to it.
 *
 * An unauthorized id gets a 404 before any storage call is made — the same
 * response as a photo that does not exist, because a 403 would confirm it does.
 */

export const dynamic = "force-dynamic";

const VARIANTS = new Set(["thumb", "web", "original"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await context.params;

  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 404, headers: noStore() });
  }

  const requested = new URL(request.url).searchParams.get("v") ?? "web";
  const variant = VARIANTS.has(requested) ? requested : "web";

  try {
    // THE authorization check. Nothing below runs unless this returns a photo.
    const photo = await getPhotoForUser(session, photoId);

    if (!photo) {
      return new NextResponse(null, { status: 404, headers: noStore() });
    }

    // Fall back down the chain: a thumbnail may not exist yet while the worker
    // is still processing, and the web variant is a fine stand-in.
    const key =
      (variant === "thumb" && photo.storageKeyThumb) ||
      (variant === "original" && photo.storageKeyOriginal) ||
      photo.storageKeyWeb ||
      photo.storageKeyOriginal;

    if (!key) {
      return new NextResponse(null, { status: 404, headers: noStore() });
    }

    const url = await getStorage().signedUrl(key, env.SIGNED_URL_TTL_SECONDS);

    return NextResponse.redirect(
      // The local driver returns a relative path; resolve it against this
      // request so both drivers behave identically to the browser.
      new URL(url, request.url),
      { status: 302, headers: noStore() },
    );
  } catch (error) {
    reportError(error, { scope: "img", photoId });
    return new NextResponse(null, { status: 404, headers: noStore() });
  }
}

/**
 * Private and never indexed.
 *
 * The redirect itself must not be cached by a shared cache: it is specific to
 * one signed-in person, and the signed URL inside it expires.
 */
function noStore(): HeadersInit {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noimageindex",
  };
}
