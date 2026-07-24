import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Card, PageHeader } from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getOverviewStats } from "@/lib/data/activity";
import { countChildren } from "@/lib/data/children";
import { listClassesForSession } from "@/lib/data/classes";
import { countPendingPickupApprovals } from "@/lib/data/pickup";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const body = (
    <>
      <p className="font-display text-4xl font-semibold text-leaf">{value}</p>
      <p className="mt-1 text-sm font-semibold text-ink-soft">{label}</p>
    </>
  );

  return (
    <Card className="text-center">
      {href ? (
        <Link href={href} className="block hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

export default async function AdminHome() {
  const session = await requireStaff("/admin");
  const isOwner = session.user.role === "OWNER";

  const [stats, classes, childCount, pendingPickups] = await Promise.all([
    isOwner ? getOverviewStats(session) : Promise.resolve(null),
    listClassesForSession(session),
    countChildren(session),
    countPendingPickupApprovals(session),
  ]);

  return (
    <div>
      <AdminNav current="/admin" role={session.user.role} />

      <PageHeader
        title={`Hello, ${session.user.name}`}
        description={
          isOwner
            ? "You have access to the whole nursery."
            : "You have access to the classes you are assigned to."
        }
      />

      {isOwner && stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Children enrolled" value={stats.children} href="/admin/children" />
            <Stat label="Classes" value={stats.classes} href="/admin/classes" />
            <Stat label="Parent accounts" value={stats.parents} href="/admin/people" />
            <Stat
              label="Invitations pending"
              value={stats.pendingInvites}
              href="/admin/people"
            />
          </div>

          {stats.unlinkedChildren > 0 ? (
            // The most consequential thing to surface: photos of these children
            // reach nobody, and it fails silently otherwise.
            <div className="mt-6 rounded-2xl border-2 border-sun/60 bg-sun-soft px-5 py-4">
              <p className="font-bold">
                {stats.unlinkedChildren}{" "}
                {stats.unlinkedChildren === 1 ? "child has" : "children have"} no
                guardian linked
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Nobody receives their photos.{" "}
                <Link
                  href="/admin/children"
                  className="font-semibold text-leaf underline underline-offset-4"
                >
                  Review children
                </Link>
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Your classes" value={classes.length} href="/admin/classes" />
          <Stat label="Children in your classes" value={childCount} href="/admin/children" />
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Photos</h2>
          <p className="mt-2 text-ink-soft">
            Upload, tag and publish photos for families.
          </p>
          <Link
            href="/admin/photos"
            className="mt-3 inline-block font-semibold text-leaf underline underline-offset-4"
          >
            Go to photos
          </Link>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold">Pickup</h2>
          {isOwner ? (
            <>
              <p className="mt-2 text-ink-soft">
                {pendingPickups > 0
                  ? `${pendingPickups} pickup ${pendingPickups === 1 ? "request is" : "requests are"} waiting for your approval.`
                  : "Nothing waiting for approval right now."}
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Link
                  href="/admin/pickup/approvals"
                  className="font-semibold text-leaf underline underline-offset-4"
                >
                  Review approvals
                </Link>
                <Link
                  href="/admin/pickup"
                  className="font-semibold text-leaf underline underline-offset-4"
                >
                  Pickup board
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-ink-soft">
                See who may collect each child in your classes today.
              </p>
              <Link
                href="/admin/pickup"
                className="mt-3 inline-block font-semibold text-leaf underline underline-offset-4"
              >
                Open the pickup board
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
