import type { Metadata } from "next";
import Link from "next/link";

import { Card, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getMyChildren, getPhotosForParent } from "@/lib/data/photos";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

export default async function PortalHome() {
  const session = await requireParent("/portal");

  const [children, recent] = await Promise.all([
    getMyChildren(session),
    getPhotosForParent(session, { limit: 8 }),
  ]);

  const names = children.map((c) => c.firstName);

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
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Latest photos</h2>
            <Link
              href="/portal/albums"
              className="text-sm font-semibold text-leaf underline underline-offset-4"
            >
              See all
            </Link>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recent.items.map((photo) => (
              <li key={photo.id}>
                <Link
                  href={`/portal/albums/${photo.id}`}
                  className="block overflow-hidden rounded-xl border border-ink/10 bg-card shadow-pin"
                >
                  <div className="aspect-square bg-paper-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/img/${photo.id}?v=thumb`}
                      alt={
                        photo.caption ??
                        (photo.taggedChildren.length > 0
                          ? `Photo of ${photo.taggedChildren.map((c) => c.firstName).join(" and ")}`
                          : "Class photo")
                      }
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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
