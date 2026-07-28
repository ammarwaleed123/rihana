"use client";

import { useState } from "react";
import { Check, Download, Share } from "lucide-react";

import { triggerInstall, useInstall } from "@/lib/pwa/install-store";

/**
 * A persistent "install the app" control for the settings pages.
 *
 * Unlike the banner, this is never dismissed — a parent who closed the banner
 * can still install from here at any time. It reflects the real state: already
 * installed, installable now (Chrome/Android button), iPhone steps, or a
 * last-resort pointer to the browser menu.
 */
export function InstallButton() {
  const { canPrompt, isInstalled, standalone, ios } = useInstall();
  const [done, setDone] = useState(false);

  if (standalone || isInstalled || done) {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-leaf">
        <Check className="size-4" aria-hidden="true" />
        Installed on this device
      </p>
    );
  }

  if (ios) {
    return (
      <p className="text-sm text-ink-soft">
        On iPhone or iPad: tap the Share button
        <Share className="mx-1 inline size-4 align-text-bottom" aria-hidden="true" />
        then <strong className="font-semibold text-ink">Add to Home Screen</strong>.
      </p>
    );
  }

  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={async () => {
          if ((await triggerInstall()) === "accepted") setDone(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-leaf-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2"
      >
        <Download className="size-4" aria-hidden="true" />
        Install app
      </button>
    );
  }

  return (
    <p className="text-sm text-ink-soft">
      To install, open your browser menu and choose{" "}
      <strong className="font-semibold text-ink">Install Rihana…</strong> (under
      &ldquo;Cast, save, and share&rdquo; in Chrome).
    </p>
  );
}
