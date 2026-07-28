"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/cn";
import { signOutAction } from "@/lib/auth/actions";

function SubmitButton({ prominent }: { prominent: boolean }) {
  const { pending } = useFormStatus();
  const label = pending ? "Signing out…" : "Sign out";

  if (prominent) {
    // Account-page treatment: a proper bordered pill in the danger tone, full
    // width on a phone so it reads as a deliberate, safe-to-tap control rather
    // than a stray link. Sits on its own in the "Sign out" card.
    return (
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-danger/30 bg-card px-6 py-3 font-bold text-danger transition-colors hover:border-danger hover:bg-coral-soft disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <SignOutIcon />
        {label}
      </button>
    );
  }

  // Header treatment: compact and quiet, so it does not compete with the nav.
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 font-bold text-ink-soft transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

/**
 * Sign-out is a POST, never a link.
 *
 * A GET /signout could be triggered by any third-party page embedding it as an
 * image — annoying rather than dangerous, but a state change belongs behind a
 * form, where Next's origin check applies.
 *
 * `prominent` gives the account-page card a full, bordered button; the default
 * is the quiet header control.
 */
export function SignOutButton({ prominent = false }: { prominent?: boolean }) {
  return (
    <form action={signOutAction} className={cn(prominent && "sm:inline-block")}>
      <SubmitButton prominent={prominent} />
    </form>
  );
}

function SignOutIcon() {
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
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 17 5 12l5-5" />
      <path d="M5 12h11" />
    </svg>
  );
}
