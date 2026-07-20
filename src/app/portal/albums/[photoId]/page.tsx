import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireParent } from "@/lib/auth/scope";
import { getPhotoForUser } from "@/lib/data/photos";

export const metadata: Metadata = {
  title: "Photo",
  robots: { index: false, follow: false },
};

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ photoId: string }>;
}) {
  const { photoId } = await params;
  const session = await requireParent(`/portal/albums/${photoId}`);

  // The same gate the image route uses. A photo this family may not see is
  // indistinguishable from one that does not exist.
  const photo = await getPhotoForUser(session, photoId);
  if (!photo) notFound();

  return (
    <div>
      <p className="mb-4">
        <Link
          href="/portal/albums"
          className="text-sm font-semibold text-leaf underline underline-offset-4"
        >
          ← Back to photos
        </Link>
      </p>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-pin">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/img/${photo.id}?v=web`}
          alt="Photo from the nursery"
          className="h-auto w-full"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {/*
          Downloads the full-size original. `download` asks the browser to save
          rather than navigate; the bytes still come through the authorized
          route, so this is not a way around the check.
        */}
        <a
          href={`/api/img/${photo.id}?v=original`}
          download
          className="inline-flex items-center rounded-full bg-leaf px-6 py-3 font-bold text-white hover:bg-leaf-dark"
        >
          Download photo
        </a>
      </div>
    </div>
  );
}
