import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { requireParent } from "@/lib/auth/scope";

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

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-ink/10 bg-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-5">
            <Link href="/portal" className="font-display text-xl font-semibold">
              Rihana Nursery
            </Link>
            <Link
              href="/portal/albums"
              className="font-bold text-ink-soft hover:text-leaf"
            >
              Photos
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:inline">
              {session.user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}
