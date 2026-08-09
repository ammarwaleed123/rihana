import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { AnnouncementBody } from "@/components/announcement-body";
import { Alert } from "@/components/ui/form";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { fill } from "@/lib/i18n/plural";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { getAnnouncementForStaff } from "@/lib/data/announcements";
import { listClassesForSession } from "@/lib/data/classes";

import { EditAnnouncementForm } from "../announcement-forms";
import {
  DeleteAnnouncementForm,
  PublishAnnouncementForm,
  UnpublishAnnouncementForm,
} from "./announcement-controls";

export const metadata: Metadata = {
  title: "Announcement",
  robots: { index: false, follow: false },
};

export default async function AnnouncementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string; withdrawn?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireStaff(`/admin/announcements/${id}`);
  const dict = await getDictionary(await getAppLocale());
  const t = dict.admin.announcementForm;

  let announcement;
  try {
    announcement = await getAnnouncementForStaff(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const classes = await listClassesForSession(session);
  const isOwner = session.user.role === "OWNER";
  const published = announcement.status === "PUBLISHED";
  const audienceLabel =
    announcement.audience === "ALL_NURSERY"
      ? t.audienceEveryone
      : fill(t.audienceClass, {
          class: announcement.class?.name ?? t.audienceFallbackClass,
        });

  return (
    <div>
      <AdminNav current="/admin/announcements" role={session.user.role} t={dict.admin.nav} />

      <p className="mb-4">
        <Link
          href="/admin/announcements"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          <span aria-hidden className="rtl:-scale-x-100">
            ←
          </span>{" "}
          {t.allAnnouncements}
        </Link>
      </p>

      <PageHeader
        title={announcement.title}
        description={
          announcement.audience === "ALL_NURSERY"
            ? t.audienceWholeNursery
            : (announcement.class?.name ?? t.aClass)
        }
        action={
          published ? (
            <Badge tone="green">{dict.admin.announcements.published}</Badge>
          ) : (
            <Badge tone="yellow">{dict.admin.announcements.draft}</Badge>
          )
        }
      />

      {query.published ? (
        <div className="mb-6">
          <Alert tone="success">
            {fill(t.publishedNotice, { audience: audienceLabel })}
          </Alert>
        </div>
      ) : null}
      {query.withdrawn ? (
        <div className="mb-6">
          <Alert tone="success">{t.withdrawnNotice}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>{t.preview}</SectionTitle>
            <AnnouncementBody markdown={announcement.body} />
          </Card>

          <Card>
            <SectionTitle>{t.edit}</SectionTitle>
            <EditAnnouncementForm t={t}
              announcement={announcement}
              classes={classes}
              canPostNursery={isOwner}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle>{published ? t.live : t.publish}</SectionTitle>
            {published ? (
              <UnpublishAnnouncementForm
                announcementId={announcement.id}
                t={t}
              />
            ) : (
              <PublishAnnouncementForm
                announcementId={announcement.id}
                audienceLabel={audienceLabel}
                t={t}
              />
            )}
          </Card>

          <Card>
            <SectionTitle>{t.delete}</SectionTitle>
            <DeleteAnnouncementForm
              announcementId={announcement.id}
              title={announcement.title}
              t={t}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
