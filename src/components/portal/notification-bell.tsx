import Link from "next/link";

/**
 * The notification bell.
 *
 * A plain link with an unread badge — the count is resolved server-side in the
 * portal layout, so it is correct on every page load without any client polling.
 * When push arrives in Phase 8, this same count drives the home-screen icon
 * badge; for now it lives here in the header.
 *
 * The badge caps at 9+ so a parent returning after a graduation-day drop does
 * not get a three-digit number spilling out of a small circle.
 */
export function NotificationBell({ unread }: { unread: number }) {
  const label =
    unread > 0
      ? `Notifications, ${unread} unread`
      : "Notifications";

  return (
    <Link
      href="/portal/notifications"
      aria-label={label}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-[1.15rem] items-center justify-center rounded-full bg-coral px-1 text-[0.7rem] font-bold leading-5 text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
