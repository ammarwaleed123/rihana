import type { Metadata } from "next";

import { AnnouncementBody } from "@/components/announcement-body";
import { LoadMore } from "@/components/portal/photo-grid";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { listAnnouncementsForParent } from "@/lib/data/announcements";

export const metadata: Metadata = {
  title: "Announcements",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/announcements");

  const page = await listAnnouncementsForParent(session, {
    cursor: params.cursor ?? null,
  });

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="News and reminders from the nursery."
      />

      {page.items.length === 0 ? (
        <EmptyState
          title="Nothing right now"
          description="When the nursery posts news for you, it will appear here."
        />
      ) : (
        <>
          <div className="space-y-4">
            {page.items.map((a) => (
              <Card key={a.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-semibold">
                    {a.title}
                  </h2>
                  {a.audience === "CLASS" && a.className ? (
                    <Badge tone="sky">{a.className}</Badge>
                  ) : null}
                </div>
                {a.publishedAt ? (
                  <p className="mb-3 text-sm text-ink-faint">
                    <time dateTime={a.publishedAt.toISOString()}>
                      {dateFormat.format(a.publishedAt)}
                    </time>
                  </p>
                ) : null}
                <AnnouncementBody markdown={a.body} />
              </Card>
            ))}
          </div>

          {page.hasMore && page.nextCursor ? (
            <LoadMore
              href={`/portal/announcements?cursor=${encodeURIComponent(page.nextCursor)}`}
              label="Load older"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
