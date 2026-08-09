"use server";

import { z } from "zod";

import { LOCALES, localePath } from "./config";
import { setLocaleCookie } from "./locale-cookie";

/**
 * The public site's language switch.
 *
 * The public site takes its language from the URL, so switching it is really
 * just a navigation — but it also has to be *remembered*, because the app behind
 * sign-in has no URL to read it from. Leaving that to the proxy (mirror the
 * locale of whatever marketing page is being served) looked tidy and does work
 * for a shared link or a typed address, but not for the one case that matters:
 * clicking the switch. Next serves that navigation from the client router cache
 * with no request at all, so the proxy never sees it and the cookie keeps saying
 * English while the page says Arabic. Writing it here instead is deterministic
 * and owes nothing to how the router happens to route.
 *
 * `href` is built HERE rather than accepted from the form. The path is checked
 * against the same small allowlist the proxy uses, so a crafted post can only
 * ever send someone to one of five public pages — an href taken straight from a
 * form is the shape of an open-redirect bug.
 */

// Must stay in step with MARKETING_PATHS in src/proxy.ts.
const PUBLIC_PATHS = ["/", "/about", "/programs", "/visit", "/enquire"] as const;

export type PublicLocaleState = { href?: string };

export async function setPublicLocaleAction(
  _prev: PublicLocaleState,
  formData: FormData,
): Promise<PublicLocaleState> {
  const parsed = z.enum(LOCALES).safeParse(formData.get("locale"));
  if (!parsed.success) return {};

  const requested = String(formData.get("path") ?? "/");
  const path = (PUBLIC_PATHS as readonly string[]).includes(requested)
    ? requested
    : "/";

  await setLocaleCookie(parsed.data);
  return { href: localePath(parsed.data, path) };
}
