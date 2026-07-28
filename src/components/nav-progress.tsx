"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Top navigation progress bar.
 *
 * A route-level loading.tsx would stream a skeleton, but that commits a 200
 * status before a page can call notFound() — which broke the "guessing an id
 * gets a 404" privacy guarantee. This is the safe alternative: a purely
 * client-side bar that appears the moment an in-app link is tapped and clears
 * once the new page's pathname is in place. No Suspense boundary is involved, so
 * notFound() still returns a real 404.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return; // internal navigations only

      const dest = new URL(href, window.location.href);
      if (dest.pathname === window.location.pathname) return; // same page / hash

      setActive(true);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    // The pathname changed → the navigation finished, so clear the bar. Deferred
    // to a timeout so it is not a synchronous setState inside the effect.
    const id = window.setTimeout(() => setActive(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-leaf-soft"
    >
      <div className="h-full w-2/5 animate-[rihana-progress_1.1s_ease-in-out_infinite] rounded-r-full bg-leaf" />
    </div>
  );
}
