import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
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
      <AdminNav current="/admin/photos" role={session.user.role} />

      <p className="mb-4">
        <Link
          href="/admin/photos"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← All uploads
        </Link>
      </p>

      <PageHeader
        title={published ? "Published photos" : "Tag these photos"}
        description={
          published
            ? `${upload.class?.name ?? ""} · families can see these now.`
            : `${upload.class?.name ?? ""} · choose who appears in each photo, then publish.`
        }
      />

      {query.withdrawn ? (
        <div className="mb-6">
          <Alert tone="success">
            Withdrawn. {query.withdrawn} photo
            {query.withdrawn === "1" ? " is" : "s are"} no longer visible to
            families. Their tags are kept, so you can correct them and publish
            again.
          </Alert>
        </div>
      ) : null}

      {query.published ? (
        // Shown on the page rather than inside the publish form, which is
        // removed the moment publishing succeeds.
        <div className="mb-6">
          <Alert tone="success">
            Published {query.published} photo
            {query.published === "1" ? "" : "s"}. Families can see them now.
            {Number(query.unreachable) > 0
              ? ` ${query.unreachable} were left unpublished because nobody is tagged in them.`
              : ""}
          </Alert>
        </div>
      ) : null}

      {photos.length === 0 ? (
        <EmptyState
          title="No photos in this upload"
          description="Add some photos to get started."
        />
      ) : (
        <>
          {unpublished > 0 ? (
            <Card className="mb-6">
              <SectionTitle>
                {published ? "New photos to share" : "Ready to share?"}
              </SectionTitle>
              <p className="mb-4 text-sm text-ink-soft">
                {published
                  ? "Photos tagged after this upload was published are not visible to families until you share them."
                  : "Publishing makes these visible in the family portal and notifies the parents of every tagged child — one message per family, not one per photo."}
              </p>
              <PublishForm
                uploadSessionId={uploadSessionId}
                photoCount={photos.length}
                untaggedCount={untagged}
                unpublishedCount={unpublished}
              />
            </Card>
          ) : null}

          {published ? (
            <Card className="mb-6">
              <SectionTitle>Withdraw these photos</SectionTitle>
              <UnpublishForm
                uploadSessionId={uploadSessionId}
                isOwner={isOwner}
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
              />
            ))}
          </div>

          <Card className="mt-6 max-w-md">
            <AddPhotosForm uploadSessionId={uploadSessionId} />
          </Card>
        </>
      )}
    </div>
  );
}
