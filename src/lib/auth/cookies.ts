import "server-only";

import { cookies } from "next/headers";

import { env, isProduction } from "@/lib/env";

/**
 * Session cookie handling.
 *
 * `__Host-` prefix in production: browsers refuse to accept such a cookie unless
 * it is Secure, Path=/ and has no Domain attribute. That makes it impossible for
 * a subdomain — including one an attacker manages to stand up — to overwrite our
 * session cookie. The prefix requires HTTPS, so plain-HTTP local development
 * uses the unprefixed name.
 */
export const SESSION_COOKIE_NAME = isProduction
  ? "__Host-rihana_session"
  : "rihana_session";

function baseOptions() {
  return {
    httpOnly: true, // JavaScript can never read it, so XSS cannot exfiltrate it
    secure: isProduction,
    sameSite: "lax" as const, // blocks cross-site POSTs; keeps normal link navigation working
    path: "/",
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  // A SESSION cookie — deliberately no `expires`/`maxAge`. The browser, and the
  // installed app, drop it the moment they are fully closed, so reopening always
  // lands on sign-in. That is the point: it proves the person opening the app is
  // the parent, not whoever picked up an unlocked phone. The session's real
  // lifetime is still capped server-side by the Session row's `expiresAt`; this
  // only controls how long the browser is willing to hold the token.
  store.set(SESSION_COOKIE_NAME, token, baseOptions());
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  // Overwrite then delete: some browsers keep a stale value if only deleted.
  store.set(SESSION_COOKIE_NAME, "", { ...baseOptions(), maxAge: 0 });
  store.delete(SESSION_COOKIE_NAME);
}

/**
 * Client IP, read from the proxy chain.
 *
 * Only ever used hashed (rate-limit keys, audit rows). The leftmost
 * X-Forwarded-For entry is client-controlled and therefore spoofable; that is
 * acceptable for these purposes and must not be relied on for authorization.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

export const SESSION_SECRET = env.SESSION_SECRET;
