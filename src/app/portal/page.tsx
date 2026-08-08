import type { Metadata } from "next";
import Link from "next/link";

import { PhotoGrid } from "@/components/portal/photo-grid";
import { Card, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { listAlbumsForParent } from "@/lib/data/albums";
import { listAnnouncementsForParent } from "@/lib/data/announcements";
import { getMyChildren, getPhotosForParent } from "@/lib/data/photos";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill, joinList, plural } from "@/lib/i18n/plural";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

export default async function PortalHome() {
  const session = await requireParent("/portal");

  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.portal.home;
  const c = dict.portal.common;

  const [children, recent, albums, announcements] = await Promise.all([
    getMyChildren(session),
    getPhotosForParent(session, { limit: 8 }),
    listAlbumsForParent(session, { limit: 2 }),
    listAnnouncementsForParent(session, { limit: 2 }),
  ]);

  const names = children.map((child) => child.firstName);
  // Intl.ListFormat, so Arabic joins with و rather than a translated "and".
  const nameList = joinList(names, locale);

  return (
    <div>
      <PageHeader
        title={fill(t.greeting, { name: session.user.name })}
        description={
          names.length > 0
            ? fill(t.subtitleWithChildren, { children: nameList })
            : t.subtitleNoChildren
        }
      />

      {recent.items.length > 0 ? (
        <section className="mb-8">
          <SectionHeading
            title={t.latestPhotos}
            href="/portal/photos"
            seeAll={c.seeAll}
          />
          <PhotoGrid
            photos={recent.items}
            hrefFor={(photo) => `/portal/photos/${photo.id}?from=/portal`}
            t={dict.portal.photo}
            locale={locale}
          />
        </section>
      ) : (
        <Card className="mb-8">
          <h2 className="font-display text-xl font-semibold">{t.noPhotosTitle}</h2>
          <p className="mt-2 text-ink-soft">
            {names.length > 0
              ? fill(t.noPhotosBody, { children: nameList })
              : t.noPhotosBodyFallback}
          </p>
        </Card>
      )}

      {albums.items.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title={t.albums} href="/portal/albums" seeAll={c.seeAll} />

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
                      {plural(c.photoCount, album.photoCount, locale)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {/*
          One card, not a growing stack: the portal home never lists every
          announcement (that would be unusable after a term's worth). It shows a
          hint of the latest and taps through to the full, paginated list.
        */}
        <Link
          href="/portal/announcements"
          className="group block rounded-2xl border border-ink/10 bg-card p-6 shadow-pin transition-colors hover:border-leaf"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">{t.announcements}</h2>
            <span className="text-sm font-semibold text-leaf underline underline-offset-4">
              {c.seeAll}
            </span>
          </div>
          {announcements.items.length > 0 ? (
            <p className="mt-2 line-clamp-1 text-ink-soft">
              {fill(t.latestPrefix, { title: announcements.items[0]!.title })}
            </p>
          ) : (
            <p className="mt-2 text-ink-soft">{t.noAnnouncements}</p>
          )}
        </Link>

        <Link
          href="/portal/pickup"
          className="group block rounded-2xl border border-ink/10 bg-card p-6 shadow-pin transition-colors hover:border-leaf"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">{t.pickup}</h2>
            <span className="text-sm font-semibold text-leaf underline underline-offset-4">
              {c.manage}
            </span>
          </div>
          <p className="mt-2 text-ink-soft">
            {names.length === 1 ? t.pickupBodyOne : t.pickupBodyMany}
          </p>
        </Link>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  href,
  seeAll,
}: {
  title: string;
  href: string;
  seeAll: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <Link
        href={href}
        className="text-sm font-semibold text-leaf underline underline-offset-4"
      >
        {seeAll}
      </Link>
    </div>
  );
}
