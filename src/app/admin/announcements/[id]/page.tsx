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
      ? "every family in the nursery"
      : `the families in ${announcement.class?.name ?? "the class"}`;

  return (
    <div>
      <AdminNav current="/admin/announcements" role={session.user.role} t={dict.admin.nav} />

      <p className="mb-4">
        <Link
          href="/admin/announcements"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← All announcements
        </Link>
      </p>

      <PageHeader
        title={announcement.title}
        description={
          announcement.audience === "ALL_NURSERY"
            ? "Whole nursery"
            : (announcement.class?.name ?? "A class")
        }
        action={
          published ? <Badge tone="green">Published</Badge> : <Badge tone="yellow">Draft</Badge>
        }
      />

      {query.published ? (
        <div className="mb-6">
          <Alert tone="success">
            Published, and a notification is on its way to {audienceLabel}.
          </Alert>
        </div>
      ) : null}
      {query.withdrawn ? (
        <div className="mb-6">
          <Alert tone="success">Withdrawn from families&rsquo; portals.</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="space-y-6">
          <Card>
            <SectionTitle>Preview</SectionTitle>
            <AnnouncementBody markdown={announcement.body} />
          </Card>

          <Card>
            <SectionTitle>Edit</SectionTitle>
            <EditAnnouncementForm
              announcement={announcement}
              classes={classes}
              canPostNursery={isOwner}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle>{published ? "Live" : "Publish"}</SectionTitle>
            {published ? (
              <UnpublishAnnouncementForm announcementId={announcement.id} />
            ) : (
              <PublishAnnouncementForm
                announcementId={announcement.id}
                audienceLabel={audienceLabel}
              />
            )}
          </Card>

          <Card>
            <SectionTitle>Delete</SectionTitle>
            <DeleteAnnouncementForm
              announcementId={announcement.id}
              title={announcement.title}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
