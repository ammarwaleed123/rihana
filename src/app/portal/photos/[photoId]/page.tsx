import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DownloadPhotoButton } from "@/components/portal/download-photo-button";
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
  /*
   * In-portal path, optionally with a query string (the page number and child
   * filter it was opened from). The pattern rejects a protocol-relative or
   * absolute URL, so `from` can never turn this into an open redirect off the
   * site.
   */
  const back =
    query.from && /^\/portal(\/[\w-]+)*(\?[\w=&%.-]*)?$/.test(query.from)
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
          A client button, not an <a href>: on the installed app a link to the
          image navigates the whole window to a file view with no way back. The
          button fetches the bytes and hands them to the OS "Save to Photos"
          flow (or a blob download on desktop), so the parent stays on this page.
        */}
        <DownloadPhotoButton photoId={photo.id} />
      </div>
    </div>
  );
}
