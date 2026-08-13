"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Parent portal navigation.
 *
 * Two renderings of one list: a row in the header on desktop, and a fixed tab
 * bar at the bottom on phones. Parents open this on a phone almost exclusively,
 * usually one-handed, and a bottom bar is the only place a thumb reaches
 * comfortably — a hamburger at the top of a 6" screen is a two-handed control.
 *
 * The active tab is decided by longest-prefix match, the same rule the admin
 * tabs use: a plain `startsWith` lights up "Home" on every page, since every
 * path begins with /portal.
 *
 * Labels arrive as a prop from the server layout: these are client components,
 * and shipping the whole dictionary to the browser to translate five words would
 * be a poor trade. The URLs are never localized — see src/lib/i18n/config.ts.
 */

type NavStrings = Dictionary["portal"]["nav"];

function navItems(t: NavStrings) {
  return [
    { href: "/portal", label: t.home, icon: HomeIcon },
    { href: "/portal/photos", label: t.photos, icon: PhotoIcon },
    { href: "/portal/reports", label: t.reports, icon: DayIcon },
    { href: "/portal/albums", label: t.albums, icon: AlbumIcon },
    { href: "/portal/pickup", label: t.pickup, icon: PickupIcon },
    { href: "/portal/account", label: t.account, icon: AccountIcon },
  ];
}

const HREFS = [
  "/portal",
  "/portal/photos",
  "/portal/albums",
  "/portal/pickup",
  "/portal/account",
];

function useActiveHref(): string | undefined {
  const pathname = usePathname();

  return HREFS.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  ).sort((a, b) => b.length - a.length)[0];
}

/** Header navigation, from `sm` upwards. */
export function PortalNavDesktop({ t }: { t: NavStrings }) {
  const active = useActiveHref();
  const items = navItems(t);

  return (
    <nav aria-label={t.ariaLabel} className="hidden sm:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.href === active ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-2 font-bold transition-colors",
                item.href === active
                  ? "bg-leaf-soft text-leaf-dark"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Bottom tab bar, below `sm`.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the labels clear of the home
 * indicator on an iPhone; without it the bottom row of text sits under the
 * system gesture area and is both hard to read and hard to tap.
 */
export function PortalNavMobile({ t }: { t: NavStrings }) {
  const active = useActiveHref();
  const items = navItems(t);

  return (
    <nav
      aria-label={t.ariaLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-card pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          const current = item.href === active;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  // 56px tall: comfortably above the 44px minimum touch target.
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-bold transition-colors",
                  current ? "text-leaf" : "text-ink-soft",
                )}
              >
                <Icon />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/*
 * Icons.
 *
 * Inline and decorative — every one sits beside a real text label, so they are
 * aria-hidden rather than given a duplicate accessible name.
 */

function iconProps() {
  return {
    "aria-hidden": true,
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function HomeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5L13 17" />
      <path d="m13 14 2.5-2.5L20 16" />
    </svg>
  );
}

/** A day's page: a sheet with a line of writing on it. */
function DayIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function AlbumIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="13" height="16" rx="2" />
      <path d="M19 6.5v13a1.5 1.5 0 0 1-1.5 1.5" />
      <path d="M7 4v16" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function PickupIcon() {
  // A shield: this is the safety-critical zone — who may collect the child.
  return (
    <svg {...iconProps()}>
      <path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </svg>
  );
}
