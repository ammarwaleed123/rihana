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
import { LOCALE_INTL } from "@/lib/i18n/config";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill, plural } from "@/lib/i18n/plural";
import { listAlbumsForStaff } from "@/lib/data/albums";
import { listClassesForSession } from "@/lib/data/classes";

import { CreateAlbumForm } from "./album-forms";

export const metadata: Metadata = {
  title: "Albums",
  robots: { index: false, follow: false },
};

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const query = await searchParams;
  const session = await requireStaff("/admin/albums");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.albums;

  // Per request, not at module scope: the formatter depends on the reader.
  const dateFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Both scoped: a teacher sees, and can create albums for, their own classes.
  const [albums, classes] = await Promise.all([
    listAlbumsForStaff(session),
    listClassesForSession(session),
  ]);

  const isOwner = session.user.role === "OWNER";

  return (
    <div>
      <AdminNav current="/admin/albums" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={t.title}
        description={t.description}
      />

      {query.deleted ? (
        <div className="mb-6">
          <Alert tone="success">
            {fill(t.deleted, { title: query.deleted })}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="h-fit">
          <SectionTitle>{t.createAlbum}</SectionTitle>
          {classes.length === 0 ? (
            <p className="text-sm text-ink-soft">
              {t.needClass}
            </p>
          ) : (
            <CreateAlbumForm t={dict.admin.albumForm} classes={classes} canChooseClass={isOwner} />
          )}
        </Card>

        <div>
          <SectionTitle>{t.allAlbums}</SectionTitle>

          {albums.length === 0 ? (
            <EmptyState title={t.emptyTitle} description={t.emptyBody} />
          ) : (
            <ul className="space-y-3">
              {albums.map((album) => (
                <li key={album.id}>
                  <Link
                    href={`/admin/albums/${album.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-card p-4 shadow-pin transition-colors hover:border-leaf"
                  >
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                      {album.coverPhotoId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/img/${album.coverPhotoId}?v=thumb`}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-lg font-semibold">
                          {album.title}
                        </p>
                        {album.status === "PUBLISHED" ? (
                          <Badge tone="green">{t.published}</Badge>
                        ) : (
                          <Badge tone="yellow">{t.draft}</Badge>
                        )}
                      </div>

                      <p className="mt-0.5 text-sm text-ink-soft">
                        {[
                          album.class?.name ?? t.wholeNursery,
                          plural(t.photoCount, album._count.photos, locale),
                          album.eventDate
                            ? dateFormat.format(album.eventDate)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
