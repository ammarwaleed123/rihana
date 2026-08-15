import { NavTabs } from "@/components/ui/shell";
import type { Role } from "@/generated/prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Admin navigation.
 *
 * Teachers are shown fewer tabs, but that is presentation only — the pages
 * themselves refuse teacher access independently. Hiding a link is never the
 * control.
 */
export function AdminNav({
  current,
  role,
  t,
}: {
  current: string;
  role: Role;
  t: Dictionary["admin"]["nav"];
}) {
  const items = [
    { href: "/admin", label: t.overview },
    { href: "/admin/photos", label: t.photos },
    { href: "/admin/albums", label: t.albums },
    { href: "/admin/reports", label: t.reports },
    { href: "/admin/accidents", label: t.accidents },
    { href: "/admin/announcements", label: t.announcements },
    { href: "/admin/pickup", label: t.pickup },
    { href: "/admin/children", label: t.children },
    { href: "/admin/classes", label: t.classes },
    ...(role === "OWNER"
      ? [
          { href: "/admin/inquiries", label: t.inquiries },
          { href: "/admin/people", label: t.people },
          { href: "/admin/activity", label: t.activity },
        ]
      : []),
    // Last, and for everyone: this is where sign out and the language setting
    // live now. The header's name link is hidden below `sm`, so without this tab
    // a staff member on a phone would have no route to signing out at all.
    { href: "/admin/account", label: t.account },
  ];

  return <NavTabs items={items} current={current} ariaLabel={t.ariaLabel} />;
}
