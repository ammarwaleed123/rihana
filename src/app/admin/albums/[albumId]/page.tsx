import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/form";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill, plural } from "@/lib/i18n/plural";
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
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.albumEditor;

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
  const unshared = album.photos.length - reachable;

  return (
    <div>
      <AdminNav current="/admin/albums" role={session.user.role} t={dict.admin.nav} />

      <p className="mb-4">
        <Link
          href="/admin/albums"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          <span aria-hidden className="rtl:-scale-x-100">
            ←
          </span>{" "}
          {t.allAlbums}
        </Link>
      </p>

      <PageHeader
        title={album.title}
        description={`${album.class?.name ?? t.wholeNursery} · ${plural(t.photoCount, album.photos.length, locale)}`}
        action={
          published ? (
            <Badge tone="green">{dict.admin.albums.published}</Badge>
          ) : (
            <Badge tone="yellow">{dict.admin.albums.draft}</Badge>
          )
        }
      />

      {query.published ? (
        <div className="mb-6">
          <Alert tone="success">
            {t.publishedNotice}{" "}
            {Number(query.reachable) === 0
              ? t.publishedNoneReachable
              : plural(t.publishedReachable, Number(query.reachable), locale)}
          </Alert>
        </div>
      ) : null}

      {query.withdrawn ? (
        <div className="mb-6">
          <Alert tone="success">{t.withdrawnNotice}</Alert>
        </div>
      ) : null}

      {!canManage ? (
        <div className="mb-6">
          <Alert tone="info">
            {album.class
              ? fill(t.viewOnlyClass, { class: album.class.name })
              : t.viewOnlyNursery}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="space-y-6 lg:order-1">
          <Card>
            <SectionTitle>{t.photosInAlbum}</SectionTitle>

            {album.photos.length === 0 ? (
              <p className="text-sm text-ink-soft">
                {canManage ? t.emptyManage : t.empty}
              </p>
            ) : (
              <>
                {canManage && unshared > 0 ? (
                  <div className="mb-4">
                    <Alert tone="info">
                      {plural(t.unsharedCount, unshared, locale)}
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
                        t={t}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {canManage && available ? (
            <Card>
              <SectionTitle>{t.addPhotos}</SectionTitle>
              <p className="mb-4 text-sm text-ink-soft">
                {album.class
                  ? fill(t.classScopeNote, { class: album.class.name })
                  : t.nurseryScopeNote}
              </p>
              <AddPhotosPicker
                albumId={album.id}
                photos={available.items}
                nextCursor={available.nextCursor}
                t={t}
                locale={locale}
              />
            </Card>
          ) : null}
        </div>

        {canManage ? (
          <div className="space-y-6 lg:order-2">
            <Card>
              <SectionTitle>
                {published ? t.withdrawTitle : t.shareTitle}
              </SectionTitle>
              {published ? (
                <UnpublishAlbumForm albumId={album.id} t={t} />
              ) : (
                <PublishAlbumForm
                  albumId={album.id}
                  reachable={reachable}
                  total={album.photos.length}
                  t={t}
                />
              )}
            </Card>

            <Card>
              <SectionTitle>{t.albumDetails}</SectionTitle>
              <EditAlbumForm t={dict.admin.albumForm}
                album={album}
                classes={classes}
                canChooseClass={isOwner}
              />
            </Card>

            <Card>
              <SectionTitle>{t.deleteTitle}</SectionTitle>
              <DeleteAlbumForm albumId={album.id} title={album.title} t={t} />
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
