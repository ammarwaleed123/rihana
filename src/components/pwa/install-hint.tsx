"use client";

import { useState } from "react";
import { Download, Share, Sparkles, X } from "lucide-react";

import {
  snoozeHint,
  triggerInstall,
  useHintSnoozed,
  useInstall,
} from "@/lib/pwa/install-store";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * A prominent, friendly nudge to install the app to the home screen.
 *
 * Shown to anyone signed in (parents and staff) who hasn't installed and hasn't
 * recently dismissed it. On Chrome/Android it fires the real install prompt in
 * one tap; on iPhone it shows the Share → Add to Home Screen steps. It relies on
 * the app-wide install store, so it appears even though the install event fired
 * on an earlier page. Dismissing snoozes it for two weeks (per account, so it
 * still appears to a different account on the same device) rather than hiding it
 * forever.
 */
export function InstallHint({
  userId,
  t,
}: {
  userId: string;
  t: Dictionary["portal"]["install"];
}) {
  const { canPrompt, standalone, ios } = useInstall();
  const snoozed = useHintSnoozed(userId);
  const [closed, setClosed] = useState(false);

  if (standalone || snoozed || closed) return null;
  // Nothing to offer: not installable here and not an iPhone.
  if (!canPrompt && !ios) return null;

  async function install() {
    const outcome = await triggerInstall();
    if (outcome === "accepted") setClosed(true);
  }

  function dismiss() {
    snoozeHint(userId);
    setClosed(true);
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-leaf/30 bg-leaf-soft/50 shadow-pin">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl bg-leaf text-white">
          <Sparkles className="size-6" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold text-ink">
            {t.hintTitle}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{t.hintBody}</p>

          {ios ? (
            <p className="mt-3 rounded-xl bg-card/70 px-3 py-2 text-sm text-ink">
              {t.hintIosBefore}
              <Share className="mx-1 inline size-4 align-text-bottom" aria-hidden="true" />
              {t.hintIosAfter}{" "}
              <strong className="font-semibold">{t.iosAddToHome}</strong>.
            </p>
          ) : (
            <button
              type="button"
              onClick={install}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-leaf-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2"
            >
              <Download className="size-4" aria-hidden="true" />
              {t.installApp}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t.hintDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-leaf-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
