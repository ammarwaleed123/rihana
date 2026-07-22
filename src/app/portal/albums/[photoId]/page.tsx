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
          `download=1` makes the route serve the bytes with a
          Content-Disposition header rather than redirecting to storage.
          The `download` attribute alone is ignored by browsers when the link
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
