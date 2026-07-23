import type { Metadata } from "next";
import Link from "next/link";

import { LoadMore, PhotoGrid } from "@/components/portal/photo-grid";
import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getMyChildren, getPhotosForParent } from "@/lib/data/photos";

export const metadata: Metadata = {
  title: "Photos",
  robots: { index: false, follow: false },
};

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; childId?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/photos");

  // Every photo below comes through getPhotosForParent — the routing rule.
  // There is no other query on this page.
  const [page, children] = await Promise.all([
    getPhotosForParent(session, {
      cursor: params.cursor ?? null,
      childId: params.childId,
    }),
    getMyChildren(session),
  ]);

  return (
    <div>
      <PageHeader
        title="Photos"
        description="Photos of your children, and pictures shared with their class."
      />

      {children.length > 1 ? (
        <nav aria-label="Filter by child" className="mb-6 flex flex-wrap gap-2">
          <ChildChip href="/portal/photos" active={!params.childId}>
            Everyone
          </ChildChip>
          {children.map((child) => (
            <ChildChip
              key={child.id}
              href={`/portal/photos?childId=${child.id}`}
              active={params.childId === child.id}
            >
              {child.firstName}
            </ChildChip>
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
          <PhotoGrid
            photos={page.items}
            hrefFor={(photo) => `/portal/photos/${photo.id}`}
          />

          {page.hasMore && page.nextCursor ? (
            <LoadMore
              href={`/portal/photos?${new URLSearchParams({
                ...(params.childId ? { childId: params.childId } : {}),
                cursor: page.nextCursor,
              })}`}
            />
          ) : null}
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
