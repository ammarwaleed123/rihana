import { NextResponse } from "next/server";

import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookies";
import { invalidateSession } from "@/lib/data/sessions";

/**
 * Lock (end) the current session.
 *
 * The portal's session-lock fires this the moment the app is hidden, closed or
 * reloaded, so a session never outlives leaving the foreground: the row is
 * deleted and the cookie cleared, and the next portal access must sign in again.
 * That is what makes "reopening always asks for sign-in" reliable — it does not
 * depend on cookie expiry, which desktop browsers restore.
 *
 * POST only. A same-origin sendBeacon carries the session cookie; a cross-site
 * POST cannot (SameSite=Lax), so this only ever ends the caller's own session —
 * and the worst a forged call could do is sign someone out, which is its job.
 */
export async function POST(): Promise<NextResponse> {
  const token = await readSessionCookie();
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  return new NextResponse(null, { status: 204 });
}
