"use client";

import { useSyncExternalStore } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { isStandalone } from "@/lib/pwa/install-store";

/**
 * The logo on the sign-in / auth pages.
 *
 * In a normal browser it links back to the public website, so a visitor who
 * landed on sign-in can return to the marketing site. In the installed app
 * (standalone) it links to the portal instead — the app stays portal-only and
 * never opens the website. Rendered on the client so it can tell the two apart;
 * the server default is the browser behaviour.
 */
export function AuthLogo() {
  const standalone = useSyncExternalStore(
    () => () => {},
    isStandalone,
    () => false,
  );
  return <BrandLogo href={standalone ? "/portal" : "/"} imgClassName="h-16 w-auto" />;
}
