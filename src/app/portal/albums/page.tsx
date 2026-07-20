import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getMyChildren, getPhotosForParent } from "@/lib/data/photos";

export const metadata: Metadata = {
  title: "Photos",
  robots: { index: false, follow: false },
};

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; childId?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/albums");

  // Every photo below comes through getPhotosForParent — the routing rule. There
  // is no other query on this page.
  const page = await getPhotosForParent(session, {
    cursor: params.cursor ?? null,
    childId: params.childId,
  });

  const children = await getMyChildren(session);

  return (
    <div>
      <PageHeader
        title="Photos"
        description="Photos of your children, and albums shared with their class."
      />

      {children.length > 1 ? (
        <nav aria-label="Filter by child" className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/portal/albums"
            aria-current={!params.childId ? "page" : undefined}
            className={
              !params.childId
                ? "rounded-full border-2 border-leaf bg-leaf px-4 py-2 font-bold text-white"
                : "rounded-full border-2 border-ink/15 bg-card px-4 py-2 font-bold hover:border-leaf"
            }
          >
            Everyone
          </Link>
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/portal/albums?childId=${child.id}`}
              aria-current={params.childId === child.id ? "page" : undefined}
              className={
                params.childId === child.id
                  ? "rounded-full border-2 border-leaf bg-leaf px-4 py-2 font-bold text-white"
                  : "rounded-full border-2 border-ink/15 bg-card px-4 py-2 font-bold hover:border-leaf"
              }
            >
              {child.firstName}
            </Link>
          ))}
        </nav>
      ) : null}

      {page.items.length === 0 ? (
        <EmptyState
          title="No photos yet"
          description="When the nursery shares photos of your child, they will appear here."
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {page.items.map((photo) => (
              <li key={photo.id}>
                <Link
                  href={`/portal/albums/${photo.id}`}
                  className="group block overflow-hidden rounded-xl border border-ink/10 bg-card shadow-pin"
                >
                  <div className="aspect-square bg-paper-deep">
                    {/* Served through /api/img, which authorizes before it
                        redirects to a short-lived signed URL. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/img/${photo.id}?v=thumb`}
                      alt={
                        photo.caption ??
                        (photo.taggedChildren.length > 0
                          ? `Photo of ${photo.taggedChildren.map((c) => c.firstName).join(" and ")}`
                          : "Class photo")
                      }
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>

                  {photo.caption ? (
                    <p className="px-3 py-2 text-sm text-ink-soft">
                      {photo.caption}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {page.hasMore && page.nextCursor ? (
            <div className="mt-8 text-center">
              <Link
                href={{
                  pathname: "/portal/albums",
                  query: { ...params, cursor: page.nextCursor },
                }}
                className="inline-block rounded-full border-2 border-ink/15 bg-card px-6 py-3 font-bold hover:border-leaf hover:text-leaf"
              >
                Load more photos
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
