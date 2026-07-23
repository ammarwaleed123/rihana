import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
import { getAlbumForStaff, getPhotosAvailableForAlbum } from "@/lib/data/albums";
import { listClassesForSession } from "@/lib/data/classes";

import { EditAlbumForm } from "../album-forms";
import {
  AddPhotosPicker,
  AlbumPhotoCard,
  DeleteAlbumForm,
  PublishAlbumForm,
  UnpublishAlbumForm,
} from "./album-editor";

export const metadata: Metadata = {
  title: "Album",
  robots: { index: false, follow: false },
};

export default async function AlbumDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<{
    cursor?: string;
    published?: string;
    reachable?: string;
    total?: string;
    withdrawn?: string;
  }>;
}) {
  const { albumId } = await params;
  const query = await searchParams;
  const session = await requireStaff(`/admin/albums/${albumId}`);

  let album;
  try {
    album = await getAlbumForStaff(session, albumId);
  } catch (error) {
    // A draft in another class 404s rather than 403s.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const canManage = album.canManage;

  // The photo picker and the class list are only needed by someone who can
  // edit. A view-only teacher never fetches them — `getPhotosAvailableForAlbum`
  // would refuse them anyway, since it is an edit-path query.
  const [available, classes] = canManage
    ? await Promise.all([
        getPhotosAvailableForAlbum(session, albumId, { cursor: query.cursor }),
        listClassesForSession(session),
      ])
    : [null, []];

  const isOwner = session.user.role === "OWNER";
  const published = album.status === "PUBLISHED";

  // Photos in the album that families can actually see. The gap between this
  // and the album's size is the thing staff most need to understand.
  const reachable = album.photos.filter((photo) => photo.publishedAt).length;

  return (
    <div>
      <AdminNav current="/admin/albums" role={session.user.role} />

      <p className="mb-4">
        <Link
          href="/admin/albums"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← All albums
        </Link>
      </p>

      <PageHeader
        title={album.title}
        description={`${album.class?.name ?? "Whole nursery"} · ${album.photos.length} photo${album.photos.length === 1 ? "" : "s"}`}
        action={
          published ? <Badge tone="green">Published</Badge> : <Badge tone="yellow">Draft</Badge>
        }
      />

      {query.published ? (
        <div className="mb-6">
          <Alert tone="success">
            Album published.{" "}
            {Number(query.reachable) === 0
              ? "No photos in it have been shared with families yet, so nobody can see it."
              : `Families can see the ${query.reachable} shared photo${query.reachable === "1" ? "" : "s"} their own child appears in.`}
          </Alert>
        </div>
      ) : null}

      {query.withdrawn ? (
        <div className="mb-6">
          <Alert tone="success">
            Album withdrawn. The photos themselves are unchanged and still
            visible in each family&rsquo;s own album.
          </Alert>
        </div>
      ) : null}

      {!canManage ? (
        <div className="mb-6">
          <Alert tone="info">
            You can view this album. Only the {album.class?.name ?? "nursery"}{" "}
            {album.class ? "teacher" : "owner"} can edit it.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="space-y-6 lg:order-1">
          <Card>
            <SectionTitle>Photos in this album</SectionTitle>

            {album.photos.length === 0 ? (
              <p className="text-sm text-ink-soft">
                {canManage
                  ? "Nothing here yet. Choose some photos below."
                  : "Nothing here yet."}
              </p>
            ) : (
              <>
                {canManage && reachable < album.photos.length ? (
                  <div className="mb-4">
                    <Alert tone="info">
                      {album.photos.length - reachable} of these have not been
                      shared with families yet. Adding a photo to an album does
                      not share it — publish it from the Photos page.
                    </Alert>
                  </div>
                ) : null}

                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {album.photos.map((photo) => (
                    <li key={photo.id}>
                      <AlbumPhotoCard
                        albumId={album.id}
                        photo={photo}
                        isCover={album.coverPhotoId === photo.id}
                        canManage={canManage}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {canManage && available ? (
            <Card>
              <SectionTitle>Add photos</SectionTitle>
              <AddPhotosPicker
                albumId={album.id}
                photos={available.items}
                nextCursor={available.nextCursor}
              />
            </Card>
          ) : null}
        </div>

        {canManage ? (
          <div className="space-y-6 lg:order-2">
            <Card>
              <SectionTitle>
                {published ? "Withdraw from families" : "Share this album"}
              </SectionTitle>
              {published ? (
                <UnpublishAlbumForm albumId={album.id} />
              ) : (
                <PublishAlbumForm
                  albumId={album.id}
                  reachable={reachable}
                  total={album.photos.length}
                />
              )}
            </Card>

            <Card>
              <SectionTitle>Album details</SectionTitle>
              <EditAlbumForm
                album={album}
                classes={classes}
                canChooseClass={isOwner}
              />
            </Card>

            <Card>
              <SectionTitle>Delete album</SectionTitle>
              <DeleteAlbumForm albumId={album.id} title={album.title} />
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
