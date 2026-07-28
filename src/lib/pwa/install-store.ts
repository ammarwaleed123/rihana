"use client";

import { useSyncExternalStore } from "react";

/**
 * App-wide install state for the PWA.
 *
 * One source of truth for "can this browser install the app right now", shared
 * by the install banner and the settings button. The `beforeinstallprompt`
 * event is caught once (early, by public/pwa-install.js) and held here, so any
 * install control that mounts later — on any page, for any role — can use it.
 *
 * Exposed through useSyncExternalStore rather than effects, which keeps the
 * components free of the "setState in an effect" pattern the linter rejects.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Attach the listeners once, from the root-layout client bootstrap.
 *
 * Because it runs in the root layout — mounted on every page, including the
 * sign-in page, and kept alive across client navigations — the install event is
 * caught wherever it fires, not only once a portal page is on screen. That is
 * what makes the install banner appear reliably.
 */
export function initInstallStore(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const noopSubscribe = () => () => {};

export async function triggerInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosStandalone === true
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

// The banner is snoozed rather than killed on dismiss, so an accidental close
// isn't permanent — it comes back after two weeks. Keyed by user id: dismissing
// on one account never hides it for another account signed in on the same
// device (each family member decides for themselves).
const SNOOZE_KEY = "rihana-install-hint-until";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function snoozeKey(userId: string): string {
  return `${SNOOZE_KEY}:${userId}`;
}

export function isHintSnoozed(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return Date.now() < Number(localStorage.getItem(snoozeKey(userId)) || 0);
}

export function snoozeHint(userId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(snoozeKey(userId), String(Date.now() + SNOOZE_MS));
  }
}

export function useInstall() {
  const canPrompt = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
  const isInstalled = useSyncExternalStore(
    subscribe,
    () => installed,
    () => false,
  );
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const ios = useSyncExternalStore(noopSubscribe, isIOS, () => false);
  return { canPrompt, isInstalled, standalone, ios };
}

export function useHintSnoozed(userId: string): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isHintSnoozed(userId),
    () => true,
  );
}
