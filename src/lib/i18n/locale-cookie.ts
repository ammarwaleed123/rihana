import "server-only";

import { cookies } from "next/headers";

import { isProduction } from "@/lib/env";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * The private app's language cookie.
 *
 * The account's `locale` column is the source of truth; this cookie is a mirror
 * of it, and exists for one reason: `proxy.ts` runs before the app can reach the
 * database, and the root layout needs a locale early enough to set
 * `<html lang dir>` on the very first byte. Without it an Arabic parent would
 * get a frame of left-to-right layout before the page corrected itself.
 *
 * It carries no authority whatsoever — the worst a tampered value can do is
 * render the interface in the wrong language. Every page still authorizes
 * through `requireSession()`, and reads the real preference from the user row.
 *
 * Written at sign-in and whenever the preference changes. Unlike the session
 * cookie it is deliberately persistent, so the language survives closing the
 * app; it is not a credential and expiring it would only cause a wrong-direction
 * flash on the next cold open.
 */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export async function readLocaleCookie(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Narrow an arbitrary stored string (e.g. `user.locale`) to a known locale. */
export function toLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
