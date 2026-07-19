import "server-only";

import { hash, verify } from "@node-rs/argon2";

/**
 * `Algorithm.Argon2id` from @node-rs/argon2, inlined.
 *
 * That enum is declared `const enum`, which TypeScript refuses to read under
 * `isolatedModules` (the value would have to be inlined at compile time, and
 * each file is transpiled in isolation). The numeric values are part of the
 * package's public API: 0 = Argon2d, 1 = Argon2i, 2 = Argon2id.
 */
const ARGON2ID = 2;

/**
 * Password hashing.
 *
 * argon2id with the OWASP Password Storage Cheat Sheet's recommended parameters
 * (m=19456 KiB, t=2, p=1). argon2id is memory-hard, which is what makes GPU and
 * ASIC cracking expensive — the property bcrypt lacks.
 *
 * Changing these parameters does not invalidate existing hashes: the cost
 * parameters are encoded in the hash string itself, so `verify` keeps working
 * against older hashes. `needsRehash` below detects them so they can be upgraded
 * on next successful login.
 */
const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A hash of a throwaway password, computed once at module load.
 *
 * Used to equalise response time when a login is attempted for an address that
 * has no account. Without it, "unknown email" returns fast and "wrong password"
 * returns slow, which turns the login form into an account-existence oracle —
 * and account existence here means "this family attends this nursery".
 */
const DUMMY_HASH_PROMISE = hash(
  "a-password-that-is-never-anyone's-actual-password",
  PARAMS,
);

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password, PARAMS);
  } catch {
    // A malformed or truncated hash must read as "wrong password", never throw
    // a 500 that distinguishes it from a normal failure.
    return false;
  }
}

/**
 * Burn the same CPU and memory a real verification would, then fail.
 *
 * Call this on the "no such user" branch of login so both branches cost the
 * same. See DUMMY_HASH_PROMISE.
 */
export async function verifyPasswordDummy(password: string): Promise<false> {
  await verify(await DUMMY_HASH_PROMISE, password, PARAMS).catch(() => false);
  return false;
}

/** True when a stored hash predates the current cost parameters. */
export function needsRehash(storedHash: string): boolean {
  const m = /\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)/.exec(storedHash);
  if (!m) return true; // not argon2id at all — definitely rehash

  const [, memory, time, parallelism] = m;
  return (
    Number(memory) < PARAMS.memoryCost ||
    Number(time) < PARAMS.timeCost ||
    Number(parallelism) !== PARAMS.parallelism
  );
}

// Policy constants live in ./password-constants.ts so client components can read
// them without importing this server-only module. Re-exported for convenience.
export {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "./password-constants";
