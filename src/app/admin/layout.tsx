import { BrandLogo } from "@/components/brand-logo";
import { AppBadgeSync } from "@/components/pwa/app-badge-sync";
import { InstallHint } from "@/components/pwa/install-hint";
import { SessionLock } from "@/components/pwa/session-lock";
import { SessionLockBoot } from "@/components/pwa/session-lock-boot";
import { NotificationBell } from "@/components/portal/notification-bell";
import { ADMIN_LOCK_MS } from "@/lib/pwa/portal-lock";
import { SignOutButton } from "@/components/sign-out-button";
import { requireStaff } from "@/lib/auth/scope";
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
              {session.user.role === "OWNER" ? "Owner" : "Teacher"}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden max-w-[16ch] truncate text-sm text-ink-soft sm:inline">
              {session.user.name}
            </span>
            <NotificationBell unread={unread} href="/admin/notifications" />
            <SignOutButton />
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
