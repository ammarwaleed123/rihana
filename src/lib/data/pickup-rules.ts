/**
 * Pure pickup rules.
 *
 * Deliberately free of `server-only`, Prisma and every side effect, so the
 * "who may collect right now" logic — the safety-critical part — is unit-tested
 * without a database. `pickup.ts` imports and re-exports these.
 */

export type PickupStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
export type PickupMethodValue = "HANDOVER" | "BUS";

/**
 * Has a time-boxed authorization lapsed?
 *
 * The expiry is a `date` with no time-of-day, and a parent who writes "this week
 * only" means the person is valid *through* that day. So the person is expired
 * only once the expiry date is strictly before the start of today — someone
 * expiring today can still collect today.
 */
export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return expiresAt.getTime() < startOfToday.getTime();
}

/** A pickup person who may actually collect right now: approved and not lapsed. */
export function isActivePickup(
  person: { status: PickupStatusValue; expiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  return person.status === "APPROVED" && !isExpired(person.expiresAt, now);
}
