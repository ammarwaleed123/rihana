"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { CtaLink, Wordmark } from "@/components/marketing/brand";

/**
 * Public site header.
 *
 * Two audiences, two actions: prospective parents get the primary "Enquire"
 * button, and existing families get "Parent login" — the quiet bridge from the
 * marketing site into the private portal. On phones both collapse into a menu,
 * which is where a thumb reaches.
 */

const NAV = [
  { href: "/", label: "Home" },
  { href: "/programs", label: "Programs" },
  { href: "/about", label: "About" },
  { href: "/visit", label: "Visit us" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Wordmark />

        {/* Desktop nav */}
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 font-display font-bold transition-colors",
                isActive(item.href)
                  ? "bg-leaf-soft text-leaf-dark"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            href="/signin"
            className="rounded-full px-4 py-2 font-display font-bold text-ink-soft transition-colors hover:text-leaf-dark"
          >
            Parent login
          </Link>
          <CtaLink href="/enquire" className="px-5 py-2.5">
            Enquire
          </CtaLink>
        </div>

        {/* Mobile toggle — a spinning pinwheel toy: idles still, twirls on
            hover, and does a full turn when the menu opens. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="group grid size-11 place-items-center rounded-2xl border-2 border-ink/10 bg-card transition-colors hover:border-leaf/40 active:scale-95 motion-reduce:active:scale-100 lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(
              "size-7 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
              open ? "rotate-[225deg]" : "rotate-0 group-hover:rotate-90",
            )}
          >
            <path d="M12 12 L12 3 Q21 3 21 12 Z" fill="#FF7A6E" />
            <path d="M12 12 L21 12 Q21 21 12 21 Z" fill="#FFC63F" />
            <path d="M12 12 L12 21 Q3 21 3 12 Z" fill="#3E7C4F" />
            <path d="M12 12 L3 12 Q3 3 12 3 Z" fill="#7AC0E4" />
            <circle cx="12" cy="12" r="2.1" fill="#33402F" />
          </svg>
        </button>
      </div>

      {/* Mobile menu — always mounted so it can animate open and closed. The
          grid-rows 0fr→1fr trick gives a smooth height reveal without measuring;
          `inert` keeps the collapsed links out of the tab order and off screen
          readers. */}
      <div
        id="mobile-menu"
        inert={open ? undefined : true}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none lg:hidden",
          open ? "grid-rows-[1fr] border-t border-ink/10" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden bg-paper">
          <div className="px-5 py-4">
            <nav aria-label="Main" className="flex flex-col gap-1">
              {NAV.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{ transitionDelay: open ? `${90 + i * 45}ms` : "0ms" }}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-2xl px-4 py-3 font-display text-lg font-bold transition-[transform,opacity,background-color,color] duration-300 ease-out motion-reduce:!translate-y-0 motion-reduce:transition-none",
                    open ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
                    isActive(item.href)
                      ? "bg-leaf-soft text-leaf-dark"
                      : "text-ink hover:bg-paper-deep",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div
              style={{
                transitionDelay: open ? `${90 + NAV.length * 45}ms` : "0ms",
              }}
              className={cn(
                "mt-3 grid grid-cols-2 gap-2.5 transition-[transform,opacity] duration-300 ease-out motion-reduce:!translate-y-0 motion-reduce:transition-none",
                open ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
              )}
            >
              <CtaLink
                href="/signin"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Parent login
              </CtaLink>
              <CtaLink href="/enquire" onClick={() => setOpen(false)}>
                Enquire
              </CtaLink>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
