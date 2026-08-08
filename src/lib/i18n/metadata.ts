import type { Metadata } from "next";

import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "./config";

/**
 * Canonical + hreflang for a public page.
 *
 * Two languages at two URLs is a duplicate-content problem unless each page
 * declares which one it is and where its counterpart lives. `languages` emits
 * the `hreflang` alternates; `x-default` points at English, which is what an
 * unmatched visitor gets.
 *
 * Paths are locale-free and root-relative ("/about"); `metadataBase` in the root
 * layout resolves them against the real domain.
 */
export function localeAlternates(locale: Locale, path: string): Metadata {
  const languages = Object.fromEntries(
    LOCALES.map((l) => [l, localePath(l, path)]),
  );

  return {
    alternates: {
      canonical: localePath(locale, path),
      languages: {
        ...languages,
        "x-default": localePath(DEFAULT_LOCALE, path),
      },
    },
  };
}
