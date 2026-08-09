import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/admin-nav";
import { InstallButton } from "@/components/pwa/install-button";
import { PushToggle } from "@/components/pwa/push-toggle";
import { Button } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { notificationText } from "@/lib/i18n/notification-text";
import { listNotifications } from "@/lib/data/notifications";
import {
  markAllReadAction,
  openNotificationAction,
} from "@/lib/admin/notification-actions";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const session = await requireStaff("/admin/notifications");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.notifications;

  // Per request, not at module scope: the formatter depends on the reader.
  const when = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const page = await listNotifications(session, {
    cursor: params.cursor ?? null,
  });
  const hasUnread = page.items.some((n) => !n.readAt);

  return (
    <div>
      <AdminNav
        current="/admin/notifications"
        role={session.user.role}
        t={dict.admin.nav}
      />

      <PageHeader
        title={t.title}
        description={t.description}
        action={
          hasUnread ? (
            <form action={markAllReadAction}>
              <Button
                type="submit"
                variant="secondary"
                className="px-4 py-2 text-sm"
              >
                {t.markAllRead}
              </Button>
            </form>
          ) : undefined
        }
      />

      <div className="mb-6 space-y-5 rounded-2xl border border-ink/10 bg-card p-5">
        <div>
          <p className="mb-2 font-bold text-ink">{t.installTitle}</p>
          <InstallButton t={dict.portal.install} />
        </div>
        <div className="border-t border-ink/10 pt-5">
          <p className="mb-2 font-bold text-ink">{t.pushTitle}</p>
          <PushToggle t={dict.portal.push} />
        </div>
      </div>

      {page.items.length === 0 ? (
        <EmptyState title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <>
          <ul className="space-y-2">
            {page.items.map((n) => {
              // Same as the portal: the row's message key, rendered in the
              // reader's language, falling back to the stored English.
              const text = notificationText(n, dict, locale);
              return (
                <li key={n.id}>
                  {/* A form, not a link: tapping marks it read AND navigates to the
                    notification's own stored path (an admin path for staff). */}
                  <form action={openNotificationAction}>
                    <input type="hidden" name="notificationId" value={n.id} />
                    <button
                      type="submit"
                      className={
                        n.readAt
                          ? "flex w-full items-start gap-3 rounded-2xl border border-ink/10 bg-card p-4 text-start shadow-pin hover:border-leaf"
                          : "flex w-full items-start gap-3 rounded-2xl border-2 border-leaf/40 bg-leaf-soft/40 p-4 text-start shadow-pin hover:border-leaf"
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
                          <span dir="auto" className="font-bold">
                            {text.title}
                          </span>
                          <time
                            dateTime={n.createdAt.toISOString()}
                            className="text-xs text-ink-faint"
                          >
                            {when.format(n.createdAt)}
                          </time>
                        </span>
                        <span
                          dir="auto"
                          className="mt-0.5 block text-sm text-ink-soft"
                        >
                          {text.body}
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          {page.hasMore && page.nextCursor ? (
            <div className="mt-6 text-center">
              <a
                href={`/admin/notifications?cursor=${encodeURIComponent(page.nextCursor)}`}
                className="font-semibold text-leaf underline underline-offset-4"
              >
                {t.loadOlder}
              </a>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
