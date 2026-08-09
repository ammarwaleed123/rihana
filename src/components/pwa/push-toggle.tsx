"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

import { subscribeToPush, unsubscribeFromPush } from "@/lib/pwa/push-actions";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Turn lock-screen push on or off for the current device.
 *
 * Push is per-device — a family might want it on their phone but not a shared
 * tablet — so this reflects and toggles the subscription for *this* browser,
 * not a global preference. Everything degrades quietly: no VAPID key, no
 * service worker, or a browser without push support renders an explanatory line
 * rather than a dead button.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "loading" | "unsupported" | "denied" | "off" | "on" | "working";

export function PushToggle({ t }: { t: Dictionary["portal"]["push"] }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;

    async function detect(): Promise<State> {
      if (
        !VAPID_PUBLIC_KEY ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return "unsupported";
      }
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      return sub ? "on" : "off";
    }

    // setState in the promise continuation, never synchronously in the effect.
    detect().then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
      const result = await subscribeToPush(JSON.parse(JSON.stringify(sub)));
      setState(result.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await unsubscribeFromPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "loading") {
    return <p className="text-sm text-ink-soft">{t.checking}</p>;
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-ink-soft">{t.unsupported}</p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-ink-soft">{t.denied}</p>
    );
  }

  const on = state === "on";
  const busy = state === "working";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy}
        className={
          on
            ? "inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink/30 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2"
            : "inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-leaf-dark disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2"
        }
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : on ? (
          <BellOff className="size-4" aria-hidden="true" />
        ) : (
          <Bell className="size-4" aria-hidden="true" />
        )}
        {busy
          ? t.justAMoment
          : on
            ? t.turnOff
            : t.turnOn}
      </button>
      <span className="text-sm text-ink-soft">
        {on
          ? t.onDescription
          : t.offDescription}
      </span>
    </div>
  );
}
