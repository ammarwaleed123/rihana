import { BrandLogo } from "@/components/brand-logo";
import { AppBadgeSync } from "@/components/pwa/app-badge-sync";
import { InstallHint } from "@/components/pwa/install-hint";
import { SessionLock } from "@/components/pwa/session-lock";
import { SessionLockBoot } from "@/components/pwa/session-lock-boot";
import { NotificationBell } from "@/components/portal/notification-bell";
import { PortalNavDesktop, PortalNavMobile } from "@/components/portal/portal-nav";
import { requireParent } from "@/lib/auth/scope";
import { unreadNotificationCount } from "@/lib/data/notifications";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";

/**
 * Parent portal shell.
 *
 * `requireParent` runs here, so every page beneath /portal is guarded even if a
 * future page forgets its own check. The proxy already bounced anonymous
 * requests; this is the check that actually validates the session, and it is
 * the one that matters.
 *
 * This layout is intentionally NOT wrapped in a Suspense boundary that flushes
 * early. Doing so (an earlier attempt at an "instant" open) makes a page's
 * `notFound()` return HTTP 200 instead of 404 — the shell has already committed
 * the status — which quietly breaks the "guessing an id gets a 404, not a 403"
 * privacy guarantee the detail pages rely on. The pre-paint <SessionLockBoot>
 * still runs from the first bytes, so a cold reopen redirects to sign-in with no
 * flash of the account.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireParent("/portal");
  const unread = await unreadNotificationCount(session);

  // Locale comes from the account preference, mirrored into a cookie and
  // resolved in proxy.ts — the portal's URLs never carry a language.
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* First child: decides the lock before the header (which prints the
          parent's name) is parsed, so a cold reopen never flashes the account. */}
      <SessionLockBoot />

      <header className="border-b border-ink/10 bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-6">
            <BrandLogo
              href="/portal"
              name={dict.meta.siteName}
              label={dict.meta.logoHome}
            />
            <PortalNavDesktop t={dict.portal.nav} />
          </div>

          {/* Sign out lives on the Account page now, so the header is just the
              logo (left) and the bell (right). */}
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden max-w-[14ch] truncate text-sm text-ink-soft lg:inline">
              {session.user.name}
            </span>
            <NotificationBell unread={unread} t={dict.portal.bell} />
          </div>
        </div>
      </header>

      {/*
        The bottom padding is for the mobile tab bar, which is fixed and would
        otherwise cover the last element on every page — most visibly the
        "Load more" button at the end of a long album.
      */}
      <main
        id="main"
        className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 pb-28 sm:pb-8"
      >
        <InstallHint userId={session.user.id} t={dict.portal.install} />
        {children}
      </main>

      <PortalNavMobile t={dict.portal.nav} />
      <AppBadgeSync count={unread} />
      <SessionLock />
    </div>
  );
}
