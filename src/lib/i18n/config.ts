/**
 * Locale configuration — the single source of truth for both halves of the app.
 *
 * Two different strategies, on purpose:
 *
 *  - **Public site** (the `(marketing)` group) is locale-routed. English is the
 *    default and unprefixed (`/about`), Arabic is prefixed (`/ar/about`). Search
 *    engines need a distinct, indexable URL per language, so the locale has to
 *    live in the path. `proxy.ts` rewrites the unprefixed English URLs onto the
 *    internal `/[lang]` segment; the address bar keeps the clean path.
 *
 *  - **Portal and admin** are `noindex`, so a URL prefix would buy nothing and
 *    cost a lot: every redirect, the sign-in `next=` parameter, the PWA
 *    `start_url` and the whole e2e suite assume `/portal/...` and `/admin/...`.
 *    There the locale is a per-account preference carried in a cookie, and the
 *    URLs never change. See `resolveAppLocale` in ./locale-app.ts.
 *
 * This module is imported by the proxy (edge runtime) as well as by client
 * components, so it must stay dependency-free and side-effect-free.
 */

export const LOCALES = ["en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

/** English is unprefixed on the public site; Arabic lives under /ar. */
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

/**
 * Where the portal/admin language preference is mirrored for the proxy.
 *
 * The account's `locale` column is the source of truth; this cookie exists only
 * so the proxy — which runs before the database is reachable — can tell the root
 * layout which direction to render on the first byte. It carries no authority:
 * the worst a tampered value can do is show the wrong language, and every
 * private page still authorizes through `requireSession()`.
 */
export const LOCALE_COOKIE = "rihana_locale";

/** Request header the proxy stamps so the root layout can set `lang`/`dir`. */
export const LOCALE_HEADER = "x-locale";

/** Writing direction. Drives the `dir` attribute and every logical CSS property. */
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
};

/**
 * The `lang` attribute value. Arabic is tagged `ar-EG` so screen readers pick an
 * Egyptian voice and `Intl` formats dates the way Cairo families read them.
 */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  ar: "ar-EG",
};

/** How each language names *itself* — never translated, by convention. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/** BCP-47 tag for Intl.DateTimeFormat / NumberFormat. */
export const LOCALE_INTL: Record<Locale, string> = {
  en: "en-GB",
  ar: "ar-EG",
};

/**
 * Turn an app-internal path into the public URL for a locale.
 *
 * The default locale is unprefixed, so `/about` stays `/about` in English and
 * becomes `/ar/about` in Arabic. Pass paths without a locale prefix.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/**
 * Split a public URL path into its locale and the locale-free remainder.
 * `/ar/about` → `{ locale: "ar", path: "/about" }`
 * `/about`    → `{ locale: "en", path: "/about" }`
 */
export function splitLocalePath(pathname: string): {
  locale: Locale;
  path: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const [first, ...rest] = segments;

  if (isLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}`.replace(/\/$/, "") || "/" };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}
