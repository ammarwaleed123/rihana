import type { Metadata } from "next";
import Link from "next/link";

import { PhotoGrid } from "@/components/portal/photo-grid";
import { Card, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { listAlbumsForParent } from "@/lib/data/albums";
import { getMyChildren, getPhotosForParent } from "@/lib/data/photos";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

export default async function PortalHome() {
  const session = await requireParent("/portal");

  const [children, recent, albums] = await Promise.all([
    getMyChildren(session),
    getPhotosForParent(session, { limit: 8 }),
    listAlbumsForParent(session, { limit: 2 }),
  ]);

  const names = children.map((child) => child.firstName);

  return (
    <div>
      <PageHeader
        title={`Hello, ${session.user.name}`}
        description={
          names.length > 0
            ? `Photos and updates for ${names.join(" and ")}.`
            : "Your child's photos and updates will appear here."
        }
      />

      {recent.items.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title="Latest photos" href="/portal/photos" />
          <PhotoGrid
            photos={recent.items}
            hrefFor={(photo) => `/portal/photos/${photo.id}?from=/portal`}
          />
        </section>
      ) : (
        <Card className="mb-8">
          <h2 className="font-display text-xl font-semibold">No photos yet</h2>
          <p className="mt-2 text-ink-soft">
            When the nursery shares photos of{" "}
            {names.length > 0 ? names.join(" or ") : "your child"}, they will
            appear here.
          </p>
        </Card>
      )}

      {albums.items.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title="Albums" href="/portal/albums" />

          <ul className="grid gap-4 sm:grid-cols-2">
            {albums.items.map((album) => (
              <li key={album.id}>
                <Link
                  href={`/portal/albums/${album.id}`}
                  className="group block overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-pin transition-colors hover:border-leaf"
                >
                  <div className="aspect-[3/2] bg-paper-deep">
                    {album.coverPhotoId ? (
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
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Announcements</h2>
          <p className="mt-2 text-ink-soft">Arriving in Phase 5.</p>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold">
            Pickup authorization
          </h2>
          <p className="mt-2 text-ink-soft">Arriving in Phase 6.</p>
        </Card>
      </div>
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <Link
        href={href}
        className="text-sm font-semibold text-leaf underline underline-offset-4"
      >
        See all
      </Link>
    </div>
  );
}
