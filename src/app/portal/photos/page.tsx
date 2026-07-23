import type { Metadata } from "next";
import Link from "next/link";

import { Pager } from "@/components/portal/pager";
import { PhotoGrid } from "@/components/portal/photo-grid";
import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { parsePageParam } from "@/lib/data/pagination";
import { getMyChildren, getPhotosPageForParent } from "@/lib/data/photos";

export const metadata: Metadata = {
  title: "Photos",
  robots: { index: false, follow: false },
};

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; childId?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/photos");

  // Every photo below comes through the routing rule; there is no other query.
  const [page, children] = await Promise.all([
    getPhotosPageForParent(session, {
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
    return qs ? `/portal/photos?${qs}` : "/portal/photos";
  };

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

      {page.total === 0 ? (
        <EmptyState
          title="No photos yet"
          description="When the nursery shares photos of your child, they will appear here."
        />
      ) : (
        <>
          <PhotoGrid
            photos={page.items}
            hrefFor={(photo) =>
              `/portal/photos/${photo.id}?from=${encodeURIComponent(hrefFor(page.page))}`
            }
          />

          <p className="mt-6 text-center text-sm text-ink-soft">
            Page {page.page} of {page.pageCount} · {page.total} photo
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
