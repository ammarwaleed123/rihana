import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { photoAltText } from "@/components/portal/photo-grid";
import { requireParent } from "@/lib/auth/scope";
import { getPhotoDetailForParent } from "@/lib/data/photos";

export const metadata: Metadata = {
  title: "Photo",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function PhotoPage({
  params,
  searchParams,
}: {
  params: Promise<{ photoId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { photoId } = await params;
  const query = await searchParams;
  const session = await requireParent(`/portal/photos/${photoId}`);

  // The same filter the image route uses. A photo this family may not see is
  // indistinguishable from one that does not exist.
  const photo = await getPhotoDetailForParent(session, photoId);
  if (!photo) notFound();

  /*
   * Where "back" goes.
   *
   * Taken from a query parameter so returning from a photo lands on the album
   * it was opened from rather than the top of the photo list. Only ever an
   * in-portal path: an attacker-supplied `from` would otherwise turn every
   * photo page into an open redirect off the site.
   */
  const back =
    query.from && /^\/portal(\/[\w-]+)*$/.test(query.from)
      ? query.from
      : "/portal/photos";

  const names = photo.taggedChildren.map((child) => child.firstName);

  return (
    <div>
      <p className="mb-4">
        <Link
          href={back}
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← Back
        </Link>
      </p>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-pin">
        {/* Empty alt when the caption is shown below it, so it is not read twice. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/img/${photo.id}?v=web`}
          alt={photo.caption ? "" : photoAltText(photo)}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          className="h-auto w-full"
        />
      </div>

      <div className="mt-5 space-y-1">
        {photo.caption ? (
          <p className="font-display text-xl font-semibold">{photo.caption}</p>
        ) : null}

        <p className="text-ink-soft">
          {names.length > 0 ? `${names.join(" and ")} · ` : ""}
          <time dateTime={photo.createdAt.toISOString()}>
            {dateFormat.format(photo.createdAt)}
          </time>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {/*
          `download=1` makes the route serve the bytes with a
          Content-Disposition header rather than redirecting to storage. The
          `download` attribute alone is ignored by browsers when the link
          resolves cross-origin, which is what our signed storage URLs are — so
          this used to open the image full-screen instead of saving it, and did
          nothing at all on a phone.
        */}
        <a
          href={`/api/img/${photo.id}?v=original&download=1`}
          className="inline-flex items-center rounded-full bg-leaf px-6 py-3 font-bold text-white hover:bg-leaf-dark"
        >
          Download photo
        </a>
      </div>
    </div>
  );
}
