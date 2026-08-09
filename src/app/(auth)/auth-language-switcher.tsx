"use client";

import { useActionState, useEffect } from "react";

import {
  setAuthLocaleAction,
  type AuthLocaleState,
} from "@/lib/i18n/auth-locale-action";
import { LOCALE_LABEL, type Locale } from "@/lib/i18n/config";

/**
 * Language toggle for the sign-in and invitation pages.
 *
 * The auth pages have no locale in their URL, so unlike the public site there is
 * nothing to link to — the choice is a cookie, and changing a cookie mid-request
 * cannot change the page you are already looking at. `<html lang dir>` comes
 * from the root layout, which resolved the locale when the request arrived, so
 * the switch only lands on a genuine reload. Hence the effect below rather than
 * a `redirect()`, which is a soft navigation and would leave the direction and
 * the copy disagreeing (the same trap as "Save language" on the account page).
 *
 * Without JavaScript this is still a real form POST, which reloads the document
 * on its own and needs no effect at all.
 *
 * Labelled in the language you would be switching *to*, and always written in
 * that language: someone who cannot read this page can still read "العربية".
 */
export function AuthLanguageSwitcher({ locale }: { locale: Locale }) {
  const [state, action] = useActionState<AuthLocaleState, FormData>(
    setAuthLocaleAction,
    {},
  );

  const switched = state.switched;
  useEffect(() => {
    if (switched) window.location.reload();
  }, [switched]);

  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <form action={action}>
      <input type="hidden" name="locale" value={other} />
      <button
        type="submit"
        // The label is in the target language, so it must be tagged as such or a
        // screen reader reads Arabic with an English voice.
        lang={other}
        className="rounded-full border-2 border-ink/12 px-3.5 py-1.5 font-display text-sm font-bold text-ink-soft transition-colors hover:border-leaf hover:text-leaf-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2"
      >
        {LOCALE_LABEL[other]}
      </button>
    </form>
  );
}
