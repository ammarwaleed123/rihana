"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { CtaLink, Wordmark } from "@/components/marketing/brand";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { localePath, splitLocalePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Public site header.
 *
 * Two audiences, two actions: prospective parents get the primary "Enquire"
 * button, and existing families get "Parent login" — the quiet bridge from the
 * marketing site into the private portal. On phones both collapse into a menu,
 * which is where a thumb reaches.
 *
 * Every link is built through `localePath`, so an Arabic visitor never falls out
 * of Arabic by clicking the nav. Sign-in is the deliberate exception: it lives
 * outside the localized marketing tree, at a single `/signin` for both
 * languages.
 */
export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = [
    { path: "/", label: dict.nav.home },
    { path: "/programs", label: dict.nav.programs },
    { path: "/about", label: dict.nav.about },
    { path: "/visit", label: dict.nav.visit },
  ];

  // Compare against the locale-free path so `/ar/programs` marks the same item
  // active as `/programs` does.
  const { path: current } = splitLocalePath(pathname);
  const isActive = (path: string) =>
    path === "/" ? current === "/" : current.startsWith(path);

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Wordmark href={localePath(locale, "/")} />

        {/* Desktop nav */}
        <nav aria-label={dict.nav.ariaLabel} className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.path}
              href={localePath(locale, item.path)}
              aria-current={isActive(item.path) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 font-display font-bold transition-colors",
                isActive(item.path)
                  ? "bg-leaf-soft text-leaf-dark"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <LanguageSwitcher locale={locale} />
          <Link
            href="/signin"
            className="rounded-full px-4 py-2 font-display font-bold text-ink-soft transition-colors hover:text-leaf-dark"
          >
            {dict.nav.parentLogin}
          </Link>
          <CtaLink href={localePath(locale, "/enquire")} className="px-5 py-2.5">
            {dict.nav.enquire}
          </CtaLink>
        </div>

        {/* Mobile: the language toggle stays out of the menu, so switching
            language is never hidden behind a tap for someone who cannot read
            the current one. */}
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher locale={locale} />

          {/* Mobile toggle — a spinning pinwheel toy: idles still, twirls on
              hover, and does a full turn when the menu opens. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? dict.nav.closeMenu : dict.nav.openMenu}
            className="group grid size-11 place-items-center rounded-2xl border-2 border-ink/10 bg-card transition-colors hover:border-leaf/40 active:scale-95 motion-reduce:active:scale-100"
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
            <nav aria-label={dict.nav.ariaLabel} className="flex flex-col gap-1">
              {nav.map((item, i) => (
                <Link
                  key={item.path}
                  href={localePath(locale, item.path)}
                  onClick={() => setOpen(false)}
                  style={{ transitionDelay: open ? `${90 + i * 45}ms` : "0ms" }}
                  aria-current={isActive(item.path) ? "page" : undefined}
                  className={cn(
                    "rounded-2xl px-4 py-3 font-display text-lg font-bold transition-[transform,opacity,background-color,color] duration-300 ease-out motion-reduce:!translate-y-0 motion-reduce:transition-none",
                    open ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
                    isActive(item.path)
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
                transitionDelay: open ? `${90 + nav.length * 45}ms` : "0ms",
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
                {dict.nav.parentLogin}
              </CtaLink>
              <CtaLink
                href={localePath(locale, "/enquire")}
                onClick={() => setOpen(false)}
              >
                {dict.nav.enquire}
              </CtaLink>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
