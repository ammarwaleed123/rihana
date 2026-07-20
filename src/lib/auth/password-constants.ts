/**
 * Password policy constants, safe to import from client components.
 *
 * Deliberately separate from ./password.ts, which is `server-only` and pulls in
 * the native argon2 binding — a client component importing that would break the
 * build. These values are shown in form hints and enforced again server-side;
 * the client copy is a convenience, never the check.
 *
 * Length is the control that matters. Composition rules ("one uppercase, one
 * symbol") mostly produce `Password1!` and are not required here, matching
 * NIST SP 800-63B guidance.
 */
/**
 * Set to 8 at the owner's request (was 12).
 *
 * Worth knowing what that trades away: 8 characters is the floor NIST SP 800-63B
 * allows, not a comfortable setting. The controls that actually carry the weight
 * here are argon2id hashing, the per-account rate limit, and account lockout —
 * none of which changed. Raising this back to 12 costs nothing but a redeploy,
 * and existing passwords keep working either way.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Upper bound exists because argon2 hashes whatever it is handed, and a
 * multi-megabyte password is a cheap way to burn server memory.
 */
export const PASSWORD_MAX_LENGTH = 200;
