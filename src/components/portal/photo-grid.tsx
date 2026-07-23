import Link from "next/link";

import type { PhotoListItem } from "@/lib/data/photos";

/**
 * The photo grid, used by the dashboard, the photo list and album pages.
 *
 * One component so the alt text is decided once. `taggedChildren` has already
 * been filtered by the data layer to this family's own children, so the name
 * of a classmate cannot reach this file — but describing a photo as "Photo of
 * Laila and Omar" is only safe *because* of that filtering, and stating the
 * rule in three separate templates is how the fourth one gets it wrong.
 */
export function photoAltText(photo: PhotoListItem): string {
  if (photo.caption) return photo.caption;

  if (photo.taggedChildren.length > 0) {
    const names = photo.taggedChildren.map((child) => child.firstName);
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    return `Photo of ${list}`;
  }

  // A class-album photo the family's own child is not tagged in. Deliberately
  // says nothing about who else is in it.
  return "Class photo";
}

export function PhotoGrid({
  photos,
  hrefFor,
}: {
  photos: PhotoListItem[];
  hrefFor: (photo: PhotoListItem) => string;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <li key={photo.id}>
          <Link
            href={hrefFor(photo)}
            className="group block overflow-hidden rounded-xl border border-ink/10 bg-card shadow-pin focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          >
            <div className="aspect-square bg-paper-deep">
              {/* Served through /api/img, which authorizes before it redirects
                  to a short-lived signed URL. */}
              {/*
                Empty alt when the caption is rendered below: the caption is
                already in the link's accessible name, and duplicating it made
                a screen reader announce "Laila jumping, Laila jumping".
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/img/${photo.id}?v=thumb`}
                alt={photo.caption ? "" : photoAltText(photo)}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </div>

            {photo.caption ? (
              <p className="px-3 py-2 text-sm text-ink-soft">{photo.caption}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Load more" for a keyset-paginated photo list. */
export function LoadMore({
  href,
  label = "Load more photos",
}: {
  href: string;
  label?: string;
}) {
  return (
    <div className="mt-8 text-center">
      <Link
        href={href}
        className="inline-block rounded-full border-2 border-ink/15 bg-card px-6 py-3 font-bold hover:border-leaf hover:text-leaf"
      >
        {label}
      </Link>
    </div>
  );
}
