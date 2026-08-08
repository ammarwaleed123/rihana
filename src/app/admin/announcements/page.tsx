import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
} from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { listAnnouncementsForStaff } from "@/lib/data/announcements";
import { listClassesForSession } from "@/lib/data/classes";

import { CreateAnnouncementForm } from "./announcement-forms";

export const metadata: Metadata = {
  title: "Announcements",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const query = await searchParams;
  const session = await requireStaff("/admin/announcements");
  const dict = await getDictionary(await getAppLocale());
  const t = dict.admin.announcements;

  const [announcements, classes] = await Promise.all([
    listAnnouncementsForStaff(session),
    listClassesForSession(session),
  ]);

  const isOwner = session.user.role === "OWNER";

  return (
    <div>
      <AdminNav current="/admin/announcements" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={t.title}
        description={t.description}
      />

      {query.deleted ? (
        <div className="mb-6">
          <Alert tone="success">Deleted the announcement “{query.deleted}”.</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <Card className="h-fit">
          <SectionTitle>{t.writeOne}</SectionTitle>
          {classes.length === 0 && !isOwner ? (
            <p className="text-sm text-ink-soft">
              {t.needClass}
            </p>
          ) : (
            <CreateAnnouncementForm t={dict.admin.announcementForm} classes={classes} canPostNursery={isOwner} />
          )}
        </Card>

        <div>
          <SectionTitle>{t.allAnnouncements}</SectionTitle>

          {announcements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="Closures, reminders, events — anything the whole nursery or a class should know."
            />
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/announcements/${a.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-card p-4 shadow-pin transition-colors hover:border-leaf"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-semibold">
                          {a.title}
                        </p>
                        {a.status === "PUBLISHED" ? (
                          <Badge tone="green">{t.published}</Badge>
                        ) : (
                          <Badge tone="yellow">{t.draft}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {a.audience === "ALL_NURSERY"
                          ? "Whole nursery"
                          : (a.class?.name ?? "A class")}{" "}
                        · {dateFormat.format(a.createdAt)}
                      </p>
                    </div>
                    <span aria-hidden className="text-ink-faint">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
