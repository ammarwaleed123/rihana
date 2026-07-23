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
import { listAlbumsForStaff } from "@/lib/data/albums";
import { listClassesForSession } from "@/lib/data/classes";

import { CreateAlbumForm } from "./album-forms";

export const metadata: Metadata = {
  title: "Albums",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const query = await searchParams;
  const session = await requireStaff("/admin/albums");

  // Both scoped: a teacher sees, and can create albums for, their own classes.
  const [albums, classes] = await Promise.all([
    listAlbumsForStaff(session),
    listClassesForSession(session),
  ]);

  const isOwner = session.user.role === "OWNER";

  return (
    <div>
      <AdminNav current="/admin/albums" role={session.user.role} />

      <PageHeader
        title="Albums"
        description="Group photos into a named album, like a graduation day. An album never shares a photo — families see only the pictures they could already see."
      />

      {query.deleted ? (
        <div className="mb-6">
          <Alert tone="success">
            Deleted the album “{query.deleted}”. The photos in it were not
            touched.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="h-fit">
          <SectionTitle>Create an album</SectionTitle>
          {classes.length === 0 ? (
            <p className="text-sm text-ink-soft">
              You need a class before you can make an album.
            </p>
          ) : (
            <CreateAlbumForm classes={classes} canChooseClass={isOwner} />
          )}
        </Card>

        <div>
          <SectionTitle>All albums</SectionTitle>

          {albums.length === 0 ? (
            <EmptyState
              title="No albums yet"
              description="Albums are a nice way to hand families a whole event at once — sports day, a trip, the last day of term."
            />
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
                          <Badge tone="green">Published</Badge>
                        ) : (
                          <Badge tone="yellow">Draft</Badge>
                        )}
                      </div>

                      <p className="mt-0.5 text-sm text-ink-soft">
                        {album.class?.name ?? "Whole nursery"} ·{" "}
                        {album._count.photos} photo
                        {album._count.photos === 1 ? "" : "s"}
                        {album.eventDate
                          ? ` · ${dateFormat.format(album.eventDate)}`
                          : ""}
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
