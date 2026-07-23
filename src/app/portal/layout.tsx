import Link from "next/link";

import { NotificationBell } from "@/components/portal/notification-bell";
import { PortalNavDesktop, PortalNavMobile } from "@/components/portal/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { requireParent } from "@/lib/auth/scope";
import { unreadNotificationCount } from "@/lib/data/notifications";

/**
 * Parent portal shell.
 *
 * `requireParent` runs here, so every page beneath /portal is guarded even if a
 * future page forgets its own check. The proxy already bounced anonymous
 * requests; this is the check that actually validates the session, and it is
 * the one that matters.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireParent("/portal");
  const unread = await unreadNotificationCount(session);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-ink/10 bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="font-display text-xl font-semibold">
              Rihana Nursery
            </Link>
            <PortalNavDesktop />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft md:inline">
              {session.user.name}
            </span>
            <NotificationBell unread={unread} />
            <SignOutButton />
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
        {children}
      </main>

      <PortalNavMobile />
    </div>
  );
}
