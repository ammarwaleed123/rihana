import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/scope";
import { getSignatureKeyForViewer } from "@/lib/data/accident-reports";
import { env } from "@/lib/env";
import { reportError } from "@/lib/logger";
import { getStorage } from "@/lib/storage";

/**
 * GET /api/img/signature/incident|acknowledgement/<id>
 *
 * The door in front of a handwritten signature — a teacher's on an accident
 * record, or a guardian's acknowledgement of one. Same three-step order as the
 * photo routes, and not negotiable:
 *   1. Authenticate.
 *   2. Ask the data layer whether this person may see this child's records.
 *   3. Only then serve it.
 *
 * An unauthorized or unknown id gets a 404 before any storage call — never a
 * 403, which would confirm the id is real. The bytes come from a short-lived
 * signed URL, so they never stream through this server.
 */

export const dynamic = "force-dynamic";

const KINDS = new Set(["incident", "acknowledgement"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await context.params;

  const session = await getSession();
  if (!session || !KINDS.has(kind)) {
    return new NextResponse(null, { status: 404, headers: noStore() });
  }

  try {
    // THE authorization check. Returns null for "not yours" and "no such
    // signature" alike.
    const key = await getSignatureKeyForViewer(
      session,
      kind as "incident" | "acknowledgement",
      id,
    );
    if (!key) {
      return new NextResponse(null, { status: 404, headers: noStore() });
    }

    const url = await getStorage().signedUrl(key, env.SIGNED_URL_TTL_SECONDS);

    return NextResponse.redirect(new URL(url, request.url), {
      status: 302,
      headers: noStore(),
    });
  } catch (error) {
    reportError(error, { scope: "img.signature", kind, id });
    return new NextResponse(null, { status: 404, headers: noStore() });
  }
}

function noStore(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noimageindex",
  };
}
