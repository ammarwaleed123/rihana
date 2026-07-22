import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/scope";
import { getPhotoForUser } from "@/lib/data/photos";
import { env } from "@/lib/env";
import { reportError } from "@/lib/logger";
import { getStorage } from "@/lib/storage";

/**
 * GET /api/img/<photoId>?v=thumb|web|original[&download=1]
 *
 * The single door in front of every image byte in this system.
 *
 * Order matters and is not negotiable:
 *   1. Authenticate.
 *   2. Ask the data layer whether this person may see this photo.
 *   3. Only then serve it.
 *
 * An unauthorized id gets a 404 before any storage call is made — the same
 * response as a photo that does not exist, because a 403 would confirm it does.
 *
 * Viewing redirects to a short-lived signed URL, so the bytes come from storage
 * or the CDN and never through this server. Downloading is the exception: see
 * below.
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

  const params = new URL(request.url).searchParams;
  const requested = params.get("v") ?? "web";
  const variant = VARIANTS.has(requested) ? requested : "web";
  const isDownload = params.get("download") === "1";

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

    if (isDownload) {
      /*
       * Downloads stream through this route instead of redirecting.
       *
       * A browser ignores the `download` attribute when the link resolves to
       * another origin, which our signed storage URLs do — so "Download photo"
       * simply opened the image full-screen instead of saving it, and on a
       * phone it did nothing useful at all. Serving the bytes ourselves lets us
       * set Content-Disposition, which is what actually makes it a download.
       *
       * This is the one place the app is in the byte path, and the spec allows
       * it: originals only on explicit download.
       */
      const body = await getStorage().get(key);

      return new NextResponse(new Uint8Array(body), {
        headers: {
          ...noStore(),
          "Content-Type": "image/jpeg",
          "Content-Length": String(body.byteLength),
          "Content-Disposition": `attachment; filename="rihana-${photoId}.jpg"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
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
 * The response must not be cached by a shared cache: it is specific to one
 * signed-in person, and any signed URL inside it expires.
 */
function noStore(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noimageindex",
  };
}
