import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { requireStaff } from "@/lib/auth/scope";

/**
 * Admin shell — owner and teachers.
 *
 * `requireStaff` guards every page beneath /admin. Role differences *within*
 * staff (a teacher may only touch their assigned classes) are enforced per
 * resource in the data layer, not here: a layout cannot know which class a
 * given page is about.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff("/admin");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-ink/10 bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="font-display text-xl font-semibold">
              Rihana Nursery
            </Link>
            <span className="rounded-full bg-sun-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink">
              {session.user.role === "OWNER" ? "Owner" : "Teacher"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:inline">
              {session.user.name}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}
