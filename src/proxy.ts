import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy — formerly `middleware.ts`, renamed in Next.js 16.
 *
 * THIS IS NOT THE AUTHORIZATION BOUNDARY. Next's own guidance is explicit that
 * proxy should not be used for session management or authorization; it runs
 * before the request reaches the app and cannot safely reach the database.
 *
 * Its job here is narrow and cheap:
 *   1. Bounce obviously-anonymous requests away from private routes, so a
 *      logged-out visitor gets a sign-in redirect instead of a rendered shell.
 *   2. Stamp a request id for log correlation.
 *
 * It checks only that a session cookie is *present*, never that it is valid — a
 * forged cookie sails straight through here and is then rejected by
 * `requireSession()` and the data layer, which are the real controls. Every
 * private page and action re-checks. Deleting this file would cost UX, not
 * security.
 */

const PRIVATE_PREFIXES = ["/portal", "/admin"];

// Must stay in sync with SESSION_COOKIE_NAME in src/lib/auth/cookies.ts.
// Both names are checked because the __Host- prefix requires HTTPS and so is
// only used in production.
const SESSION_COOKIE_NAMES = ["__Host-rihana_session", "rihana_session"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", crypto.randomUUID());

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isPrivate) {
    const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
      request.cookies.has(name),
    );

    if (!hasSessionCookie) {
      const signIn = new URL("/signin", request.url);
      // Preserve where they were heading so sign-in can return them there.
      signIn.searchParams.set("next", `${pathname}${search}`);

      const response = NextResponse.redirect(signIn);
      // Private routes must never be cached by a shared cache, redirect included.
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (isPrivate) {
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  /*
   * Everything except Next internals and static assets. Photos are served by a
   * route handler under /api/img, which performs its own authorization and must
   * not be short-circuited here.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
