import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill, plural } from "@/lib/i18n/plural";
import { getUploadSession, getUploadSessionPhotos } from "@/lib/data/photos";
import { getTaggableChildren } from "@/lib/data/uploads";

import { AddPhotosForm } from "../upload-form";
import { PhotoCard, PublishForm, UnpublishForm } from "./photo-card";

export const metadata: Metadata = {
  title: "Tag photos",
  robots: { index: false, follow: false },
};

export default async function TagPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ uploadSessionId: string }>;
  searchParams: Promise<{
    published?: string;
    unreachable?: string;
    withdrawn?: string;
  }>;
}) {
  const { uploadSessionId } = await params;
  const query = await searchParams;
  const session = await requireStaff(`/admin/photos/${uploadSessionId}`);
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.photoCard;

  let photos;
  let upload;
  try {
    [photos, upload] = await Promise.all([
      getUploadSessionPhotos(session, uploadSessionId),
      getUploadSession(session, uploadSessionId),
    ]);
  } catch (error) {
    // Out-of-scope or missing upload sessions 404 rather than 403.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const children = upload.class
    ? await getTaggableChildren(session, upload.class.id)
    : [];

  const published = upload.status === "PUBLISHED";
  const isOwner = session.user.role === "OWNER";

  const untagged = photos.filter(
    (p) => p.tagCount === 0 && p.visibility !== "CLASS_ALBUM",
  ).length;

  // Photos that can reach someone but have not been published yet — including
  // ones tagged after this upload was first published.
  const unpublished = photos.filter(
    (p) =>
      !p.publishedAt && (p.tagCount > 0 || p.visibility === "CLASS_ALBUM"),
  ).length;

  return (
    <div>
      <AdminNav current="/admin/photos" role={session.user.role} t={dict.admin.nav} />

      <p className="mb-4">
        <Link
          href="/admin/photos"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          <span aria-hidden className="rtl:-scale-x-100">
            ←
          </span>{" "}
          {t.allUploads}
        </Link>
      </p>

      <PageHeader
        title={published ? t.titlePublished : t.titleTag}
        description={fill(published ? t.descPublished : t.descTag, {
          class: upload.class?.name ?? "",
        })}
      />

      {query.withdrawn ? (
        <div className="mb-6">
          <Alert tone="success">
            {plural(t.withdrawnNotice, Number(query.withdrawn), locale)}
          </Alert>
        </div>
      ) : null}

      {query.published ? (
        // Shown on the page rather than inside the publish form, which is
        // removed the moment publishing succeeds.
        <div className="mb-6">
          <Alert tone="success">
            {plural(t.publishedNotice, Number(query.published), locale)}
            {Number(query.unreachable) > 0
              ? ` ${plural(t.unreachableSuffix, Number(query.unreachable), locale)}`
              : ""}
          </Alert>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <EmptyState title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <>
          {unpublished > 0 ? (
            <Card className="mb-6">
              <SectionTitle>
                {published ? t.newPhotosToShare : t.readyToShare}
              </SectionTitle>
              <p className="mb-4 text-sm text-ink-soft">
                {published ? t.newPhotosNote : t.readyNote}
              </p>
              <PublishForm
                uploadSessionId={uploadSessionId}
                photoCount={photos.length}
                untaggedCount={untagged}
                unpublishedCount={unpublished}
                t={t}
                locale={locale}
              />
            </Card>
          ) : null}

          {published ? (
            <Card className="mb-6">
              <SectionTitle>{t.withdrawTitle}</SectionTitle>
              <UnpublishForm
                uploadSessionId={uploadSessionId}
                isOwner={isOwner}
                t={t}
              />
            </Card>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                taggableChildren={children}
                uploadSessionId={uploadSessionId}
                published={published}
                t={t}
              />
            ))}
          </div>

          <Card className="mt-6 max-w-md">
            <AddPhotosForm t={dict.admin.uploadForm} locale={locale} uploadSessionId={uploadSessionId} />
          </Card>
        </>
      )}
    </div>
  );
}
