import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque token primitives, shared by sessions, invites and password resets.
 *
 * The rule for all three: the raw token exists only in the cookie or the email.
 * The database stores nothing but its SHA-256. A dump of any of these tables
 * therefore yields no usable credential.
 *
 * SHA-256 (not argon2) is correct here: these tokens are 256 bits of CSPRNG
 * output, so there is no low-entropy secret to brute-force and no reason to pay
 * a slow-hash cost on every request. Passwords are the opposite case — see
 * ./password.ts.
 */

/** 32 bytes = 256 bits of entropy. Not guessable, not enumerable. */
const TOKEN_BYTES = 32;

/** A newly minted token: the raw secret plus the digest to persist. */
export type IssuedToken = {
  /** Send this to the user. Never store it. */
  token: string;
  /** Store this. Never send it. */
  hash: string;
};

export function issueToken(): IssuedToken {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time string comparison.
 *
 * Lookups by hash are indexed, so timing there is not the concern; this exists
 * for the places where two digests are compared directly and an early-exit
 * `===` would leak how many leading characters matched.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  // timingSafeEqual throws on length mismatch, which would itself be a signal.
  if (bufferA.length !== bufferB.length) return false;

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Hash of a client IP, for rate-limit keys and audit rows.
 *
 * We need to correlate abuse without retaining visitor IP addresses in
 * plaintext. Keyed with SESSION_SECRET so the digests are not reversible with a
 * rainbow table over the (small) IPv4 space.
 */
export function hashIp(ip: string | null | undefined, secret: string): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${secret}:${ip}`, "utf8").digest("hex");
}
