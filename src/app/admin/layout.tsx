import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { AppBadgeSync } from "@/components/pwa/app-badge-sync";
import { InstallHint } from "@/components/pwa/install-hint";
import { SessionLock } from "@/components/pwa/session-lock";
import { SessionLockBoot } from "@/components/pwa/session-lock-boot";
import { NotificationBell } from "@/components/portal/notification-bell";
import { ADMIN_LOCK_MS } from "@/lib/pwa/portal-lock";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { unreadNotificationCount } from "@/lib/data/notifications";

/**
 * Admin shell — owner and teachers.
 *
 * `requireStaff` guards every page beneath /admin. Role differences *within*
 * staff (a teacher may only touch their assigned classes) are enforced per
 * resource in the data layer, not here: a layout cannot know which class a
 * given page is about.
 *
 * Not wrapped in an early-flushing Suspense boundary on purpose — see the note
 * in the parent-portal layout: streaming the shell first turns a page's
 * `notFound()` into a 200, which breaks the "guessing an id gets a 404" scoping
 * guarantee the admin detail pages depend on.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff("/admin");
  const unread = await unreadNotificationCount(session);
  const dict = await getDictionary(await getAppLocale());

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* First child: decides the lock before the header (which prints the
          staff member's name) is parsed, so a cold reopen never flashes. */}
      <SessionLockBoot idleMs={ADMIN_LOCK_MS} />

      <header className="border-b border-ink/10 bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo href="/admin" />
            <span className="whitespace-nowrap rounded-full bg-sun-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink">
              {session.user.role === "OWNER"
                ? dict.admin.roleOwner
                : dict.admin.roleTeacher}
            </span>
          </div>

          {/* Sign out lives on the Account page now, the same as it does for
              parents — beside the bell it was a mis-tap away from ending a
              teacher's shift mid-upload. The name is the way in. */}
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/admin/account"
              className="hidden max-w-[16ch] truncate rounded-full px-2 py-1 text-sm text-ink-soft transition-colors hover:bg-paper hover:text-ink sm:inline-block"
            >
              {session.user.name}
            </Link>
            <NotificationBell
              unread={unread}
              href="/admin/notifications"
              t={dict.portal.bell}
            />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <InstallHint userId={session.user.id} />
        {children}
      </main>
      <AppBadgeSync count={unread} />
      <SessionLock idleMs={ADMIN_LOCK_MS} />
    </div>
  );
}
