import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Shared marketing brand bits.
 *
 * The public site reuses the app's construction-paper tokens (leaf, sun, coral,
 * paper) so the nursery reads as one organisation — but it gets its own CTA and
 * a proper SVG logo mark rather than the emoji used in throwaway sketches.
 */

/** A friendly sprout — the nursery's mark. Decorative; label lives beside it. */
export function SproutMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* stem */}
      <path
        d="M16 29V15"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* left leaf */}
      <path
        d="M16 19c-1.5-5-5.5-7-9.5-7 0 4.5 3 8 9.5 8.5"
        fill="var(--color-leaf-soft)"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* right leaf */}
      <path
        d="M16 16c1.2-6 5.5-8.5 10-8.5 0 5.5-3.5 9.5-10 10"
        fill="var(--color-leaf-soft)"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The header logo — the real Rihana Montessori Academy badge.
 *
 * `href` is a prop rather than a hardcoded "/" so the Arabic site's logo returns
 * to the Arabic home page.
 */
export function Wordmark({
  className,
  href = "/",
  label = "Rihana Montessori Academy — home",
}: {
  className?: string;
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("inline-flex items-center", className)}
    >
      <Image
        src="/logo.png"
        alt="Rihana Montessori Academy"
        width={507}
        height={492}
        priority
        className="h-16 w-auto sm:h-[4.5rem]"
      />
    </Link>
  );
}

type CtaVariant = "primary" | "sun" | "outline";

const ctaVariants: Record<CtaVariant, string> = {
  primary: "bg-leaf text-white shadow-pin hover:bg-leaf-dark",
  sun: "bg-sun text-ink shadow-pin hover:brightness-[0.97]",
  outline: "border-2 border-ink/15 bg-card text-ink hover:border-leaf hover:text-leaf-dark",
};

/**
 * A link that looks like a button. The app's `Button` is a real `<button>` for
 * form actions; marketing CTAs are navigation, so they are links with the same
 * chunky, pill treatment.
 */
export function CtaLink({
  href,
  variant = "primary",
  className,
  children,
  ...props
}: {
  href: string;
  variant?: CtaVariant;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3",
        "font-display font-bold transition-all duration-200 active:translate-y-px",
        "hover:-translate-y-0.5",
        ctaVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/** Small uppercase section label — the editorial eyebrow above a heading. */
export function Eyebrow({
  children,
  tone = "leaf",
}: {
  children: ReactNode;
  tone?: "leaf" | "coral" | "sun" | "sky";
}) {
  const tones = {
    leaf: "text-leaf",
    coral: "text-coral-dark",
    sun: "text-warning",
    sky: "text-sky",
  } as const;
  return (
    <span
      className={cn(
        // `u-eyebrow` neutralises the uppercase + letter-spacing under RTL:
        // Arabic is cursive, so tracking severs the joins between letters, and
        // the script has no uppercase for `text-transform` to apply. See
        // globals.css.
        "u-eyebrow font-display text-xs font-bold uppercase tracking-[0.16em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
