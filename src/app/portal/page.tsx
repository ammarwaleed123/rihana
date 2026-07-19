import type { Metadata } from "next";

import { requireParent } from "@/lib/auth/scope";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

/**
 * Parent dashboard placeholder. The real dashboard — albums, announcements,
 * pickup list — is built in Phase 4.
 */
export default async function PortalHome() {
  const session = await requireParent("/portal");

  return (
    <div>
      <h1 className="text-3xl font-semibold">Hello, {session.user.name}</h1>
      <p className="mt-2 text-ink-soft">
        Your child&rsquo;s photos and updates will appear here.
      </p>

      <div className="mt-8 rounded-2xl border border-ink/10 bg-card p-6 shadow-pin">
        <p className="text-ink-soft">
          Albums, announcements and pickup authorization arrive in Phases 4 to 6.
        </p>
      </div>
    </div>
  );
}
