import type { MetadataRoute } from "next";

import { DEFAULT_LOCALE, LOCALES, localePath } from "@/lib/i18n/config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rihana.com";

/**
 * Only the public marketing pages — the private zones are noindex.
 *
 * Every page is listed once per language, and each entry carries the full set of
 * `alternates.languages` so Google treats the pair as one page in two languages
 * rather than as duplicates competing with each other.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["/", "/programs", "/about", "/visit", "/enquire"];

  return routes.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}${localePath(locale, route)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: route === "/" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries([
          ...LOCALES.map((l) => [l, `${SITE_URL}${localePath(l, route)}`]),
          ["x-default", `${SITE_URL}${localePath(DEFAULT_LOCALE, route)}`],
        ]),
      },
    })),
  );
}
