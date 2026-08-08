import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Card, PageHeader } from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { getOverviewStats } from "@/lib/data/activity";
import { countChildren } from "@/lib/data/children";
import { listClassesForSession } from "@/lib/data/classes";
import { countNewInquiries } from "@/lib/data/inquiries";
import { countPendingPickupApprovals } from "@/lib/data/pickup";
import { fill, plural } from "@/lib/i18n/plural";

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
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.home;
  const isOwner = session.user.role === "OWNER";

  const [stats, classes, childCount, pendingPickups, newInquiries] =
    await Promise.all([
      isOwner ? getOverviewStats(session) : Promise.resolve(null),
      listClassesForSession(session),
      countChildren(session),
      countPendingPickupApprovals(session),
      countNewInquiries(session),
    ]);

  return (
    <div>
      <AdminNav current="/admin" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={fill(t.greeting, { name: session.user.name })}
        description={isOwner ? t.ownerScope : t.teacherScope}
      />

      {isOwner && stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t.statChildren} value={stats.children} href="/admin/children" />
            <Stat label={t.statClasses} value={stats.classes} href="/admin/classes" />
            <Stat label={t.statParents} value={stats.parents} href="/admin/people" />
            <Stat
              label={t.statInvites}
              value={stats.pendingInvites}
              href="/admin/people"
            />
          </div>

          {stats.unlinkedChildren > 0 ? (
            // The most consequential thing to surface: photos of these children
            // reach nobody, and it fails silently otherwise.
            <div className="mt-6 rounded-2xl border-2 border-sun/60 bg-sun-soft px-5 py-4">
              <p className="font-bold">
                {plural(t.unlinkedTitle, stats.unlinkedChildren, locale)}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {t.unlinkedBody}{" "}
                <Link
                  href="/admin/children"
                  className="font-semibold text-leaf underline underline-offset-4"
                >
                  {t.reviewChildren}
                </Link>
              </p>
            </div>
          ) : null}

          {newInquiries > 0 ? (
            <div className="mt-6 rounded-2xl border-2 border-leaf/40 bg-leaf-soft px-5 py-4">
              <p className="font-bold">
                {plural(t.newInquiriesTitle, newInquiries, locale)}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {plural(t.newInquiriesBody, newInquiries, locale)}{" "}
                <Link
                  href="/admin/inquiries"
                  className="font-semibold text-leaf underline underline-offset-4"
                >
                  {t.openInquiries}
                </Link>
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label={t.statYourClasses} value={classes.length} href="/admin/classes" />
          <Stat
            label={t.statChildrenInYourClasses}
            value={childCount}
            href="/admin/children"
          />
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">{t.photosTitle}</h2>
          <p className="mt-2 text-ink-soft">{t.photosBody}</p>
          <Link
            href="/admin/photos"
            className="mt-3 inline-block font-semibold text-leaf underline underline-offset-4"
          >
            {t.goToPhotos}
          </Link>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold">{t.pickupTitle}</h2>
          {isOwner ? (
            <>
              <p className="mt-2 text-ink-soft">
                {pendingPickups > 0
                  ? plural(t.pickupWaiting, pendingPickups, locale)
                  : t.pickupNothing}
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Link
                  href="/admin/pickup/approvals"
                  className="font-semibold text-leaf underline underline-offset-4"
                >
                  {t.reviewApprovals}
                </Link>
                <Link
                  href="/admin/pickup"
                  className="font-semibold text-leaf underline underline-offset-4"
                >
                  {t.pickupBoard}
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-ink-soft">
                {t.teacherPickupBody}
              </p>
              <Link
                href="/admin/pickup"
                className="mt-3 inline-block font-semibold text-leaf underline underline-offset-4"
              >
                {t.openPickupBoard}
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
