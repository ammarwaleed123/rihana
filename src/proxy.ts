import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  LOCALES,
} from "@/lib/i18n/config";

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

/**
 * Carry the language chosen on the public site into the app.
 *
 * The public site takes its language from the URL and the app takes its own from
 * a cookie, so without this a visitor reading `/ar/...` would arrive at a sign-in
 * page in English — the language they just chose forgotten at the door. Mirroring
 * the URL locale into the cookie makes the choice follow them into sign-in, and
 * from there `signInAction` carries it onto their account.
 *
 * Only for a signed-OUT visitor. Someone already signed in has a language saved
 * on their account, and merely browsing the public site must not silently
 * overwrite it — that would flip an Arabic parent to English for clicking the
 * logo. The cookie is a display preference and grants nothing (see
 * i18n/locale-cookie.ts); the worst a wrong value does is show the wrong words.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function rememberPublicLocale(
  response: NextResponse,
  request: NextRequest,
  locale: string | null,
): NextResponse {
  if (!locale) return response;

  const signedIn = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (signedIn) return response;

  /*
   * Only a real page the person navigated to counts as "what they are reading".
   *
   * Next prefetches the links in view, so the sign-in page — whose logo points
   * at the English home — quietly fetched `/` in the background, and that
   * overwrote the Arabic the visitor had just chosen while they were looking at
   * an Arabic page. A prefetch is the browser's idea, not the reader's, and must
   * never restate a preference.
   *
   * `Sec-Fetch-Dest` is the browser's own answer to "what is this request for",
   * and it says `document` only for a real navigation — a prefetch or an RSC
   * fetch says `empty`. Framework headers (`RSC`, `Next-Router-Prefetch`) would
   * be guessing at the same thing and change between releases. Absent entirely
   * means a non-browser client, which is not a preference either way.
   */
  if (request.headers.get("sec-fetch-dest") !== "document") return response;

  // Nothing to do if it already says this — avoids a Set-Cookie on every hit.
  if (request.cookies.get(LOCALE_COOKIE)?.value === locale) return response;

  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
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
   * Resolve the locale for the public marketing pages ONLY, and hand it over as
   * a request header. The root layout cannot derive it alone: it sits above the
   * `[lang]` segment and serves the portal, admin and auth pages too.
   *
   * On the public site the URL is the only authority. An unprefixed path IS the
   * English page, so a stale "ar" preference cookie must not flip it to RTL and
   * leave Arabic chrome around English copy.
   *
   * Everything else is deliberately left OUT, so the root layout falls back to
   * reading the cookie at render time:
   *
   *  - The private app's locale is a cookie the user changes from inside the
   *    app. A header stamped here is frozen at the start of the request, so the
   *    re-render that follows "Save language" would still carry the PREVIOUS
   *    language and the change would only appear on the next navigation — the
   *    "press save twice" bug.
   *  - The auth pages have no locale in their URL, so the cookie is all there
   *    is. A returning Arabic-speaking parent gets an Arabic sign-in page, and
   *    anyone else can switch with the toggle in the auth header.
   *
   * Note this is computed from the allowlist, not from `!isPrivate`: a bare
   * `!isPrivate` would also stamp 404s and every future non-marketing route.
   *
   * The incoming header is DELETED first, always. `requestHeaders` is a copy of
   * what the client sent, so anything the app reads from it must be something
   * this function put there — otherwise a request carrying its own `x-locale`
   * would decide the language on every path we choose not to stamp, and the
   * cookie the user actually set would be ignored. Nothing here is a security
   * boundary (the worst outcome is the wrong language), but a header the app
   * trusts and the client controls is the shape of a bug worth not having.
   */
  requestHeaders.delete(LOCALE_HEADER);

  const marketingLocale = urlLocale
    ? isMarketingPath(pathname.slice(`/${urlLocale}`.length) || "/")
      ? urlLocale
      : null
    : isMarketingPath(pathname)
      ? DEFAULT_LOCALE
      : null;

  if (marketingLocale) {
    requestHeaders.set(LOCALE_HEADER, marketingLocale);
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
    return rememberPublicLocale(
      NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
      request,
      marketingLocale,
    );
  }

  const response = rememberPublicLocale(
    NextResponse.next({ request: { headers: requestHeaders } }),
    request,
    marketingLocale,
  );

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
