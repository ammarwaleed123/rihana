"use client";

import { useEffect } from "react";

import { initInstallStore } from "@/lib/pwa/install-store";

/**
 * Registers the service worker once the page has finished loading, and starts
 * the app-wide install-prompt store.
 *
 * Mounted in the root layout so the app is installable everywhere and the push
 * handler is ready wherever a family lands. Registration is deferred to the load
 * event so it never competes with hydration on a slow phone, and every failure
 * is swallowed — a browser without service workers just gets the normal site.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Persists across client navigations (root layout stays mounted), so the
    // install event is caught wherever it fires, not only inside the portal.
    initInstallStore();

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // A registration failure must never break the page.
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
