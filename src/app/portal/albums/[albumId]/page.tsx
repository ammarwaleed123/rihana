import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pager } from "@/components/portal/pager";
import { PhotoGrid } from "@/components/portal/photo-grid";
import { PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getAlbumForParent } from "@/lib/data/albums";
import { parsePageParam } from "@/lib/data/pagination";

export const metadata: Metadata = {
  title: "Album",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { albumId } = await params;
  const query = await searchParams;
  const session = await requireParent(`/portal/albums/${albumId}`);

  // Null covers "no such album", "not published" and "nothing in it for you"
  // alike. All three are a 404 — telling them apart would confirm the album
  // exists and, from its title, roughly what is in it.
  const detail = await getAlbumForParent(session, albumId, {
    page: parsePageParam(query.page),
  });
  if (!detail) notFound();

  const { album, photos } = detail;

  const hrefFor = (n: number) =>
    n > 1
      ? `/portal/albums/${album.id}?page=${n}`
      : `/portal/albums/${album.id}`;

  return (
    <div>
      <p className="mb-4">
        <Link
          href="/portal/albums"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← All albums
        </Link>
      </p>

      <PageHeader
        title={album.title}
        description={[
          album.eventDate ? dateFormat.format(album.eventDate) : null,
          `${album.photoCount} photo${album.photoCount === 1 ? "" : "s"}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {album.description ? (
        <p className="-mt-4 mb-8 max-w-2xl text-ink-soft">{album.description}</p>
      ) : null}

      <PhotoGrid
        photos={photos.items}
        // `from` brings the back link home to this album (this page) rather than
        // the photo list. Validated as an in-portal path on the way out.
        hrefFor={(photo) =>
          `/portal/photos/${photo.id}?from=${encodeURIComponent(hrefFor(photos.page))}`
        }
      />

      {photos.pageCount > 1 ? (
        <p className="mt-6 text-center text-sm text-ink-soft">
          Page {photos.page} of {photos.pageCount}
        </p>
      ) : null}

      <Pager page={photos.page} pageCount={photos.pageCount} hrefFor={hrefFor} />
    </div>
  );
}
