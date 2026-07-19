"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/form";
import { cn } from "@/lib/cn";

/**
 * A show/hide panel for inline forms.
 *
 * Native <details> would be simpler, but it cannot be closed programmatically
 * after a successful submit, which is exactly what these forms need to do. This
 * keeps the same semantics — a labelled toggle with aria-expanded and
 * aria-controls — while staying controllable.
 */
export function Disclosure({
  label,
  openLabel,
  children,
  variant = "primary",
  defaultOpen = false,
}: {
  label: string;
  openLabel?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  variant?: "primary" | "secondary";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <Button
        type="button"
        variant={open ? "secondary" : variant}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (openLabel ?? "Cancel") : label}
      </Button>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "mt-4 rounded-2xl border border-ink/10 bg-paper-deep/40 p-5",
          !open && "hidden",
        )}
      >
        {typeof children === "function" ? children(() => setOpen(false)) : children}
      </div>
    </div>
  );
}
