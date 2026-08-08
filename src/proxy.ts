import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { DEFAULT_LOCALE, LOCALE_HEADER, LOCALES } from "@/lib/i18n/config";

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
 *   2. Map the public site's clean URLs onto the internal `/[lang]` segment.
 *   3. Stamp a request id for log correlation.
 *
 * It checks only that a session cookie is *present*, never that it is valid — a
 * forged cookie sails straight through here and is then rejected by
 * `requireSession()` and the data layer, which are the real controls. Every
 * private page and action re-checks. Deleting this file would cost UX, not
 * security.
 */

const PRIVATE_PREFIXES = ["/portal", "/admin"];

/**
 * The public marketing routes, which are the *only* paths that get a locale.
 *
 * This is an allowlist rather than a "rewrite everything except…" denylist, and
 * that is a security choice: a denylist that ever falls out of step with the
 * route tree would start rewriting `/portal/...` into the marketing segment.
 * Adding a marketing page means adding it here.
 */
const MARKETING_PATHS = ["/about", "/programs", "/visit", "/enquire"];

function isMarketingPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    MARKETING_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  );
}

/** True for `/ar`, `/ar/...` — a path that already names its locale. */
function localePrefixOf(pathname: string): string | null {
  const first = pathname.split("/")[1];
  return (LOCALES as readonly string[]).includes(first) ? first : null;
}

// Must stay in sync with SESSION_COOKIE_NAME in src/lib/auth/cookies.ts.
// Both names are checked because the __Host- prefix requires HTTPS and so is
// only used in production.
const SESSION_COOKIE_NAMES = ["__Host-rihana_session", "rihana_session"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", crypto.randomUUID());

  const urlLocale = localePrefixOf(pathname);

  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  /*
   * Resolve the locale for everything EXCEPT the private app, and hand it over
   * as a request header. The root layout cannot derive it alone: it sits above
   * the `[lang]` segment and serves the portal and admin too.
   *
   *  - Public site: the URL is the only authority. An unprefixed path IS the
   *    English page, so a stale "ar" preference cookie must not flip it to RTL
   *    and leave Arabic chrome around English copy.
   *  - Everything else here — sign-in, invite, password-reset — stays on the
   *    default until those pages are translated. Honouring the cookie there
   *    would render English copy right-to-left, which is worse than either.
   *
   * The private app is deliberately left OUT. Its locale is a cookie the user
   * can change from inside the app, and a header stamped here is frozen at the
   * start of the request — so the re-render that follows "Save language" would
   * still carry the *previous* language, and the change would only appear on the
   * next navigation (the "press save twice" bug). Omitting the header tells the
   * root layout to read the cookie at render time instead, where a value just
   * written by the server action is already visible.
   */
  if (!isPrivate) {
    requestHeaders.set(LOCALE_HEADER, urlLocale ?? DEFAULT_LOCALE);
  }

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

  /*
   * `/en/about` is the internal route, not a public URL. Left reachable it
   * would serve the English page at two addresses — the duplicate-content
   * problem that having an unprefixed default locale exists to avoid. Redirect
   * permanently to the clean form so there is exactly one canonical URL, and so
   * any link that ever leaked the prefixed form still lands correctly.
   */
  if (!isPrivate && urlLocale === DEFAULT_LOCALE) {
    const stripped = pathname.slice(`/${DEFAULT_LOCALE}`.length) || "/";
    if (isMarketingPath(stripped)) {
      const url = request.nextUrl.clone();
      url.pathname = stripped;
      return NextResponse.redirect(url, 308);
    }
  }

  /*
   * Locale routing for the public site only.
   *
   * English is the default and is served unprefixed, so `/about` has to reach
   * the internal `/en/about` route. That is a rewrite, not a redirect: the
   * address bar keeps the clean URL, and there is exactly one canonical
   * location per page for search engines.
   *
   * Arabic URLs already carry their locale (`/ar/about`) and match the `[lang]`
   * segment directly, so they pass straight through. Private routes never reach
   * this branch — `isMarketingPath` is an allowlist.
   */
  if (!isPrivate && !localePrefixOf(pathname) && isMarketingPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
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
