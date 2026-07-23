import type { Metadata } from "next";
import Link from "next/link";

import { LoadMore } from "@/components/portal/photo-grid";
import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { listAlbumsForParent } from "@/lib/data/albums";

export const metadata: Metadata = {
  title: "Albums",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/albums");

  // Only albums holding at least one photo this family may see. An album of
  // other children simply does not exist here.
  const page = await listAlbumsForParent(session, {
    cursor: params.cursor ?? null,
  });

  return (
    <div>
      <PageHeader
        title="Albums"
        description="Collections the nursery has put together, like a sports day or a school trip."
      />

      {page.items.length === 0 ? (
        <EmptyState
          title="No albums yet"
          description="When the nursery groups photos into an album, it will appear here."
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {page.items.map((album) => (
              <li key={album.id}>
                <Link
                  href={`/portal/albums/${album.id}`}
                  className="group block overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-pin transition-colors hover:border-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
                >
                  <div className="aspect-[3/2] bg-paper-deep">
                    {album.coverPhotoId ? (
                      // The cover is resolved per family: if the album's chosen
                      // cover is a photo they may not see, they get the first
                      // one they can.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/img/${album.coverPhotoId}?v=thumb`}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div className="p-4">
                    <p className="font-display text-lg font-semibold">
                      {album.title}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {album.photoCount} photo
                      {album.photoCount === 1 ? "" : "s"}
                      {album.eventDate
                        ? ` · ${dateFormat.format(album.eventDate)}`
                        : ""}
                    </p>
                    {album.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-ink-soft">
                        {album.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {page.hasMore && page.nextCursor ? (
            <LoadMore
              href={`/portal/albums?cursor=${encodeURIComponent(page.nextCursor)}`}
              label="Load more albums"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
