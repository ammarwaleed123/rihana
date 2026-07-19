import type { Metadata } from "next";

import { requireStaff } from "@/lib/auth/scope";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin dashboard placeholder. Children, classes, accounts and photo management
 * are built in Phases 2 and 3.
 */
export default async function AdminHome() {
  const session = await requireStaff("/admin");

  return (
    <div>
      <h1 className="text-3xl font-semibold">Hello, {session.user.name}</h1>
      <p className="mt-2 text-ink-soft">
        {session.user.role === "OWNER"
          ? "You have access to the whole nursery."
          : "You have access to the classes you are assigned to."}
      </p>

      <div className="mt-8 rounded-2xl border border-ink/10 bg-card p-6 shadow-pin">
        <p className="text-ink-soft">
          Children, classes, parent accounts and photo uploads arrive in Phases 2
          and 3.
        </p>
      </div>
    </div>
  );
}
