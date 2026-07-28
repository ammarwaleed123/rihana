/**
 * Constants for the parent-portal auto-lock (Phase 8).
 *
 * The lock keeps an active session alive during continuous use but requires a
 * fresh sign-in once the app has been away, idle, or closed — the "prove it's
 * really the parent" control. Two client markers drive it:
 *
 *  - WARM (sessionStorage): set at sign-in, cleared by the browser when the
 *    tab/app is closed. Its absence on load means a cold reopen → re-auth. This
 *    is what makes "close → reopen always signs in" reliable without depending
 *    on cookie behaviour (which desktop browsers restore).
 *  - ACTIVE (localStorage): the last time the parent actually used the portal,
 *    refreshed on interaction. Once it is older than LOCK_MS the session is
 *    locked — this is the away/idle timer.
 */

export const PORTAL_WARM_KEY = "rihana-portal-warm";
export const PORTAL_ACTIVE_KEY = "rihana-portal-active";

/** Away / idle grace before the parent portal locks. 3 minutes. */
export const PORTAL_LOCK_MS = 3 * 60 * 1000;

/**
 * Idle grace before the admin area locks. 15 minutes — staff do long, focused
 * work and multitask across tabs, so this protects a walked-away-from office or
 * door tablet without interrupting active work. Combined with the upload guard
 * below, an in-progress upload never locks.
 */
export const ADMIN_LOCK_MS = 15 * 60 * 1000;

/**
 * "Something long-running is happening, don't lock yet" — a reference count so
 * the auto-lock never fires mid-upload. The upload form brackets its work with
 * begin/end; the lock treats a busy page as active.
 */
let busyCount = 0;

export function beginBusy(): void {
  busyCount += 1;
}

export function endBusy(): void {
  busyCount = Math.max(0, busyCount - 1);
}

export function isBusy(): boolean {
  return busyCount > 0;
}
