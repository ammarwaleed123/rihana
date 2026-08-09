"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect } from "react";

import { cn } from "@/lib/cn";
import {
  LOCALE_LABEL,
  splitLocalePath,
  type Locale,
} from "@/lib/i18n/config";
import {
  setPublicLocaleAction,
  type PublicLocaleState,
} from "@/lib/i18n/public-locale-action";

/**
 * Public-site language toggle.
 *
 * With exactly two languages, a dropdown would be three interactions to do one
 * thing. This is a single control that names the language you would be switching
 * *to*, always written in that language — the convention every bilingual site
 * follows, because someone who cannot read the current page can still read the
 * word "العربية". It switches the same page rather than going home, so a visitor
 * reading about the programs stays on the programs page.
 *
 * A form rather than a link, for one reason: the choice has to be *remembered*
 * so it carries into sign-in and the portal, which have no locale in their URL.
 * A link is served from the client router cache with no request, so nothing
 * server-side ever learns of the switch. Search engines lose nothing — every
 * public page already declares its counterpart with `hreflang` alternates in its
 * metadata, which is the signal crawlers actually read.
 *
 * The navigation is a full load: `<html lang dir>` comes from the root layout,
 * and a soft navigation is not guaranteed to re-render it — the same trap that
 * made "Save language" appear to need two presses on the account page.
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

  const [state, action] = useActionState<PublicLocaleState, FormData>(
    setPublicLocaleAction,
    {},
  );

  const href = state.href;
  useEffect(() => {
    if (href) window.location.assign(href);
  }, [href]);

  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <form action={action}>
      <input type="hidden" name="locale" value={other} />
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        // The label is in the target language, so it must be tagged as such or a
        // screen reader will read Arabic with an English voice.
        lang={other}
        className={cn(
          "rounded-full border-2 border-ink/12 px-3.5 py-1.5 font-display text-sm font-bold text-ink-soft transition-colors hover:border-leaf hover:text-leaf-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2",
          className,
        )}
      >
        {LOCALE_LABEL[other]}
      </button>
    </form>
  );
}
