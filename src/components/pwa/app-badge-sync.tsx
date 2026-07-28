"use client";

import { useEffect } from "react";

/**
 * Keeps the home-screen app-icon badge in step with the unread count while the
 * app is open.
 *
 * The service worker sets the badge from a push when the app is closed; this is
 * the other half — when the family is actually in the app, the badge should
 * track what the bell shows and clear the moment they have read everything.
 * Guarded because the Badging API is absent on iOS Safari and older Android,
 * where it simply does nothing.
 */
export function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) {
      return;
    }
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [count]);

  return null;
}
