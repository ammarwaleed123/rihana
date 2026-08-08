import "server-only";

import { readLocaleCookie } from "./locale-cookie";
import type { Locale } from "./config";

/**
 * The private app's locale for this request.
 *
 * Reads the cookie store directly rather than a header stamped by the proxy.
 * That matters for correctness, not just tidiness: the proxy runs once, at the
 * start of the request, so a header would still hold the OLD language during
 * the re-render that follows "Save language" — the user would have to save
 * twice to see the change. The cookie store reflects a value written earlier in
 * the same request by the server action, so one press is enough.
 *
 * This is deliberately the *same* source the root layout falls back to for
 * `<html lang dir>` on private routes, so the copy and the layout direction can
 * never disagree.
 *
 * The user row remains the durable store: it repopulates the cookie at every
 * sign-in, so the two converge across devices.
 */
export async function getAppLocale(): Promise<Locale> {
  return readLocaleCookie();
}
