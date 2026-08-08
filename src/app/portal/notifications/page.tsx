import type { Metadata } from "next";

import { LoadMore } from "@/components/portal/photo-grid";
import { Button } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { listNotifications } from "@/lib/data/notifications";
import {
  markAllReadAction,
  openNotificationAction,
} from "@/lib/portal/notification-actions";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const session = await requireParent("/portal/notifications");

  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.portal.notifications;
  const when = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const page = await listNotifications(session, { cursor: params.cursor ?? null });
  const hasUnread = page.items.some((n) => !n.readAt);

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          hasUnread ? (
            <form action={markAllReadAction}>
              <Button type="submit" variant="secondary" className="px-4 py-2 text-sm">
                {t.markAllRead}
              </Button>
            </form>
          ) : undefined
        }
      />

      {page.items.length === 0 ? (
        <EmptyState title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <>
          <ul className="space-y-2">
            {page.items.map((n) => (
              <li key={n.id}>
                {/*
                  A form, not a link: tapping it marks the notification read AND
                  navigates to what it is about (the action redirects to the
                  notification's own stored path). Works without JavaScript.
                */}
                <form action={openNotificationAction}>
                  <input type="hidden" name="notificationId" value={n.id} />
                  <button
                    type="submit"
                    className={
                      n.readAt
                        ? "flex w-full items-start gap-3 rounded-2xl border border-ink/10 bg-card p-4 text-left shadow-pin hover:border-leaf"
                        : "flex w-full items-start gap-3 rounded-2xl border-2 border-leaf/40 bg-leaf-soft/40 p-4 text-left shadow-pin hover:border-leaf"
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        n.readAt
                          ? "mt-1.5 size-2.5 shrink-0 rounded-full bg-transparent"
                          : "mt-1.5 size-2.5 shrink-0 rounded-full bg-leaf"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-bold">{n.title}</span>
                        <time
                          dateTime={n.createdAt.toISOString()}
                          className="text-xs text-ink-faint"
                        >
                          {when.format(n.createdAt)}
                        </time>
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {n.body}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>

          {page.hasMore && page.nextCursor ? (
            <LoadMore
              href={`/portal/notifications?cursor=${encodeURIComponent(page.nextCursor)}`}
              label={dict.portal.common.loadOlder}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
