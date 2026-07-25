import type { Metadata } from "next";
import Link from "next/link";

import { Pager } from "@/components/portal/pager";
import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getAlbumsPageForParent } from "@/lib/data/albums";
import { parsePageParam } from "@/lib/data/pagination";
import { getMyChildren } from "@/lib/data/photos";

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
  searchParams: Promise<{ page?: string; childId?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/albums");

  // Only albums holding at least one photo this family may see — narrowed to
  // one child when a chip is chosen. An album of other children simply does not
  // exist here.
  const [page, children] = await Promise.all([
    getAlbumsPageForParent(session, {
      page: parsePageParam(params.page),
      childId: params.childId,
    }),
    getMyChildren(session),
  ]);

  // Preserve the child filter when moving between pages.
  const hrefFor = (n: number) => {
    const query = new URLSearchParams();
    if (params.childId) query.set("childId", params.childId);
    if (n > 1) query.set("page", String(n));
    const qs = query.toString();
    return qs ? `/portal/albums?${qs}` : "/portal/albums";
  };

  return (
    <div>
      <PageHeader
        title="Albums"
        description="Collections the nursery has put together, like a sports day or a school trip."
      />

      {children.length > 1 ? (
        <nav aria-label="Filter by child" className="mb-6 flex flex-wrap gap-2">
          <ChildChip href="/portal/albums" active={!params.childId}>
            Everyone
          </ChildChip>
          {children.map((child) => (
            <ChildChip
              key={child.id}
              href={`/portal/albums?childId=${child.id}`}
              active={params.childId === child.id}
            >
              {child.firstName}
            </ChildChip>
          ))}
        </nav>
      ) : null}

      {page.total === 0 ? (
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

          <p className="mt-6 text-center text-sm text-ink-soft">
            Page {page.page} of {page.pageCount} · {page.total} album
            {page.total === 1 ? "" : "s"}
          </p>

          <Pager page={page.page} pageCount={page.pageCount} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}

function ChildChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-full border-2 border-leaf bg-leaf px-4 py-2 font-bold text-white"
          : "rounded-full border-2 border-ink/15 bg-card px-4 py-2 font-bold hover:border-leaf"
      }
    >
      {children}
    </Link>
  );
}
