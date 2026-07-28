"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Save a photo to the phone's gallery — without leaving the page.
 *
 * The old plain <a href> pointed the app at the raw image URL. In the installed
 * (standalone) app that navigates the whole window to a file view with no back
 * button, so the parent is stranded. Instead we fetch the bytes and hand them to
 * the platform, which differs by OS:
 *
 *  - Android / desktop: a normal download from an in-memory blob. On Android the
 *    download lands in the gallery automatically, so we save first and then still
 *    raise the share sheet, so the parent can send it on if they want.
 *  - iOS: a web app cannot write to Photos directly (Apple allows no such API).
 *    The only route to the gallery is the share sheet's "Save Image", so that is
 *    what we open. It sits over the page and closes back to it — no dead-end.
 *
 * A short toast confirms where the photo went. `v=original&download=1` makes the
 * image route stream the bytes to us same-origin (no redirect, no CORS).
 */

type Tone = "success" | "error";

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as a Mac; the touch points give it away.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DownloadPhotoButton({ photoId }: { photoId: string }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ tone: Tone; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function flash(tone: Tone, text: string) {
    setToast({ tone, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4500);
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setToast(null);

    try {
      const res = await fetch(`/api/img/${photoId}?v=original&download=1`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`image request failed: ${res.status}`);

      const blob = await res.blob();
      const type = blob.type || "image/jpeg";
      const ext =
        type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
      const filename = `rihana-${photoId}.${ext}`;
      const file = new File([blob], filename, { type });

      const canShareFile =
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (isIOS()) {
        // iOS: the share sheet's "Save Image" is the only path to Photos.
        if (canShareFile) {
          try {
            await navigator.share({ files: [file] });
            flash("success", "Choose “Save Image” to add it to your Photos.");
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            // fall through to a plain download
          }
        }
        saveBlob(blob, filename);
        flash("success", "Saved to your device.");
        return;
      }

      // Android / desktop: save to the gallery automatically…
      saveBlob(blob, filename);
      flash("success", "Saved to your gallery.");

      // …then still offer the share sheet (Android), so it can be sent on. The
      // save already happened, so a dismissed or unsupported share is harmless.
      if (canShareFile) {
        try {
          await navigator.share({ files: [file] });
        } catch {
          /* dismissed or unavailable — the photo is already saved */
        }
      }
    } catch {
      flash("error", "Couldn't save the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-leaf px-6 py-3 font-bold text-white transition-colors hover:bg-leaf-dark disabled:opacity-70"
      >
        <DownloadIcon />
        {busy ? "Saving…" : "Download photo"}
      </button>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-8"
        >
          <div
            className={cn(
              "max-w-sm rounded-full px-5 py-3 text-center text-sm font-bold text-white shadow-lg",
              toast.tone === "error" ? "bg-danger" : "bg-ink",
            )}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
