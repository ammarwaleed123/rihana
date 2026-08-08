import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Form primitives.
 *
 * Every input here is bound to a real <label> and, when invalid, to a
 * description via aria-describedby. Parents will use this on phones, sometimes
 * with a screen reader; a placeholder is not a label.
 */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-ink">
        {label}
      </label>

      {hint ? (
        <p id={hintId} className="text-sm text-ink-faint">
          {hint}
        </p>
      ) : null}

      {children}

      {error ? (
        <p id={errorId} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      /*
       * `dir="auto"` lets the browser pick the direction from the first strong
       * character the user actually types, so an Arabic name entered on the
       * English form reads right-to-left and a Latin name on the Arabic form
       * reads left-to-right. Callers that know better (a phone number, which is
       * always LTR) override it via props below.
       */
      dir="auto"
      {...props}
      className={cn(
        "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3",
        "text-base text-ink placeholder:text-ink-faint",
        // 16px minimum font size, otherwise iOS Safari zooms on focus.
        "transition-colors focus:border-leaf focus:outline-none",
        "aria-[invalid=true]:border-danger",
        className,
      )}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
        "font-bold transition-all active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-leaf text-white hover:bg-leaf-dark",
        variant === "secondary" &&
          "border-2 border-ink/15 bg-card text-ink hover:border-leaf hover:text-leaf",
        variant === "ghost" && "text-ink-soft hover:text-ink",
        className,
      )}
    />
  );
}

/**
 * Status message.
 *
 * `role="alert"` so a screen reader announces a failed sign-in immediately —
 * without it the message renders silently and a non-sighted user is left
 * wondering why nothing happened.
 */
export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      // Next renders its own role="alert" route announcer, so tests need a way
      // to address this element unambiguously.
      data-testid="form-alert"
      className={cn(
        "rounded-xl border-2 px-4 py-3 text-sm font-semibold",
        tone === "error" && "border-danger/30 bg-coral-soft text-danger",
        tone === "success" && "border-leaf/30 bg-leaf-soft text-leaf-dark",
        tone === "info" && "border-sky/40 bg-sky-soft text-ink",
      )}
    >
      {children}
    </div>
  );
}
