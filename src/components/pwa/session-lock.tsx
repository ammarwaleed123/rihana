"use client";

import { useEffect } from "react";

import {
  isBusy,
  PORTAL_ACTIVE_KEY,
  PORTAL_LOCK_MS,
  PORTAL_WARM_KEY,
} from "@/lib/pwa/portal-lock";

/**
 * Auto-lock for the signed-in areas.
 *
 * Keeps an active session alive during continuous use, but requires a fresh
 * sign-in once the app has been closed, or left idle past `idleMs` — so a
 * stranger who picks up the phone (or a walked-away-from tablet) later is met by
 * the sign-in page, while active use is never interrupted. A plain reload keeps
 * the session (the tab marker survives it); a real close clears the marker, so
 * reopening always signs in. While a page is busy (an upload in progress) it
 * counts as active and never locks.
 *
 * Parents use a short window (PORTAL_LOCK_MS); the admin area a longer one
 * (ADMIN_LOCK_MS). Locking invalidates the session server-side (via /api/lock)
 * so it cannot be bypassed. Skipped under automation (navigator.webdriver) so
 * the e2e suite, which drives hard navigations, is not signed out between steps.
 */
export function SessionLock({ idleMs = PORTAL_LOCK_MS }: { idleMs?: number }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || navigator.webdriver) return;

    let locking = false;

    // On storage errors (private mode) these fail safe — never lock a legitimate
    // user out; the feature just degrades to "no auto-lock".
    const isWarm = () => {
      try {
        return sessionStorage.getItem(PORTAL_WARM_KEY) === "1";
      } catch {
        return true;
      }
    };
    const lastActive = () => {
      try {
        return Number(localStorage.getItem(PORTAL_ACTIVE_KEY) || 0);
      } catch {
        return Date.now();
      }
    };
    const markActive = () => {
      try {
        localStorage.setItem(PORTAL_ACTIVE_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    };

    const lock = () => {
      if (locking) return;
      locking = true;
      void (async () => {
        try {
          await fetch("/api/lock", { method: "POST", keepalive: true });
        } catch {
          // Best effort — the redirect still forces sign-in.
        }
        const next = window.location.pathname + window.location.search;
        window.location.replace(`/signin?next=${encodeURIComponent(next)}`);
      })();
    };

    /** Lock if the session is cold or stale; otherwise optionally refresh it. */
    const check = (refresh: boolean) => {
      if (locking) return;
      if (isBusy()) {
        markActive(); // an upload (or other long task) is running — treat as active
        return;
      }
      if (!isWarm()) return lock(); // cold reopen — never authenticated in this instance
      if (Date.now() - lastActive() > idleMs) return lock(); // away/idle too long
      if (refresh) markActive();
    };

    // The portal just rendered — enforce immediately.
    check(true);

    // Refresh the activity clock on real interaction (throttled).
    let lastMark = Date.now();
    const onInteract = () => {
      if (locking) return;
      const t = Date.now();
      if (t - lastMark > 5000) {
        lastMark = t;
        markActive();
      }
    };
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    for (const type of events) {
      window.addEventListener(type, onInteract, { passive: true });
    }

    // Returning to the tab re-checks the away time.
    const onVisibility = () => {
      if (document.visibilityState === "visible") check(true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Catches foreground idle (app open, untouched past the window).
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") check(false);
    }, 20_000);

    return () => {
      for (const type of events) window.removeEventListener(type, onInteract);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [idleMs]);

  return null;
}
