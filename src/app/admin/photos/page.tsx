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
import { plural } from "@/lib/i18n/plural";
import { listClassesForSession } from "@/lib/data/classes";
import { listUploadSessions } from "@/lib/data/photos";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "Photos",
  robots: { index: false, follow: false },
};

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const query = await searchParams;
  const session = await requireStaff("/admin/photos");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.photos;

  // Both scoped: a teacher uploads into, and sees uploads for, their own
  // classes only.
  const [classes, uploads] = await Promise.all([
    listClassesForSession(session),
    listUploadSessions(session),
  ]);

  return (
    <div>
      <AdminNav current="/admin/photos" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={t.title}
        description={t.description}
      />

      {query.deleted ? (
        // Shown here because the tagging page it was deleted from no longer
        // exists once its last photo is gone.
        <div className="mb-6">
          <Alert tone="success">
            {t.deleted}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <SectionTitle>{t.newUpload}</SectionTitle>
          <UploadForm t={dict.admin.uploadForm} locale={locale} classes={classes} />
        </Card>

        <div>
          <SectionTitle>{t.recentUploads}</SectionTitle>

          {uploads.length === 0 ? (
            <EmptyState title={t.emptyTitle} description={t.emptyBody} />
          ) : (
            <ul className="space-y-3">
              {uploads.map((upload) => {
                const published = upload.status === "PUBLISHED";

                return (
                  <li
                    key={upload.id}
                    className="rounded-2xl border border-ink/10 bg-card p-4 shadow-pin"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-semibold">
                          {upload.class?.name ?? t.noClass}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {plural(t.photoCount, upload._count.photos, locale)}{" "}
                          · {upload.uploader.name} ·{" "}
                          {upload.createdAt.toISOString().slice(0, 10)}
                        </p>
                      </div>

                      {published ? (
                        <Badge tone="green">{t.published}</Badge>
                      ) : (
                        <Badge tone="yellow">{t.notPublished}</Badge>
                      )}
                    </div>

                    <p className="mt-3">
                      <Link
                        href={`/admin/photos/${upload.id}`}
                        className="font-semibold text-leaf underline underline-offset-4"
                      >
                        {published ? t.viewPhotos : t.tagAndPublish}
                      </Link>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
