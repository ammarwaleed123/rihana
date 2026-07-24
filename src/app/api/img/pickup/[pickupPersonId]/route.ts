import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/scope";
import { getPickupPersonImageKey } from "@/lib/data/pickup";
import { env } from "@/lib/env";
import { reportError } from "@/lib/logger";
import { getStorage } from "@/lib/storage";

/**
 * GET /api/img/pickup/<pickupPersonId>?v=thumb|photo
 *
 * The door in front of a pickup person's photograph. Same three-step order as
 * the child-photo route, and not negotiable:
 *   1. Authenticate.
 *   2. Ask the data layer whether this person may see this child's pickup people.
 *   3. Only then serve it.
 *
 * An unauthorized or unknown id gets a 404 before any storage call — never a 403,
 * which would confirm the id is real. The bytes come from a short-lived signed
 * URL, so they never stream through this server.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ pickupPersonId: string }> },
) {
  const { pickupPersonId } = await context.params;

  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 404, headers: noStore() });
  }

  const requested = new URL(request.url).searchParams.get("v");
  const variant = requested === "photo" ? "photo" : "thumb";

  try {
    // THE authorization check. Returns null for "not yours" and "no such photo"
    // alike.
    const key = await getPickupPersonImageKey(session, pickupPersonId, variant);
    if (!key) {
      return new NextResponse(null, { status: 404, headers: noStore() });
    }

    const url = await getStorage().signedUrl(key, env.SIGNED_URL_TTL_SECONDS);

    return NextResponse.redirect(new URL(url, request.url), {
      status: 302,
      headers: noStore(),
    });
  } catch (error) {
    reportError(error, { scope: "img.pickup", pickupPersonId });
    return new NextResponse(null, { status: 404, headers: noStore() });
  }
}

function noStore(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noimageindex",
  };
}
