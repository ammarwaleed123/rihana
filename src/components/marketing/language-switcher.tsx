"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import {
  LOCALE_LABEL,
  localePath,
  splitLocalePath,
  type Locale,
} from "@/lib/i18n/config";

/**
 * Public-site language toggle.
 *
 * With exactly two languages, a dropdown would be three interactions to do one
 * thing. This is a single link that names the language you would be switching
 * *to*, always written in that language — the convention every bilingual site
 * follows, because someone who cannot read the current page can still read the
 * word "العربية".
 *
 * It links to the same page in the other locale rather than a generic home, so
 * a visitor reading about the programs stays on the programs page. The URL is
 * the sole authority for the public site's language, so there is no cookie to
 * write here and no state to keep in sync.
 */
export function LanguageSwitcher({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const pathname = usePathname();
  const { path } = splitLocalePath(pathname);

  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <Link
      href={localePath(other, path)}
      hrefLang={other}
      // The label is in the target language, so it must be tagged as such or a
      // screen reader will read Arabic with an English voice.
      lang={other}
      className={cn(
        "rounded-full border-2 border-ink/12 px-3.5 py-1.5 font-display text-sm font-bold text-ink-soft transition-colors hover:border-leaf hover:text-leaf-dark",
        className,
      )}
    >
      {LOCALE_LABEL[other]}
    </Link>
  );
}
