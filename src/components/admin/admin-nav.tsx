import { NavTabs } from "@/components/ui/shell";
import type { Role } from "@/generated/prisma/client";

/**
 * Admin navigation.
 *
 * Teachers are shown fewer tabs, but that is presentation only — the pages
 * themselves refuse teacher access independently. Hiding a link is never the
 * control.
 */
export function AdminNav({ current, role }: { current: string; role: Role }) {
  const items = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/photos", label: "Photos" },
    { href: "/admin/albums", label: "Albums" },
    { href: "/admin/children", label: "Children" },
    { href: "/admin/classes", label: "Classes" },
    ...(role === "OWNER"
      ? [
          { href: "/admin/people", label: "Parents & staff" },
          { href: "/admin/activity", label: "Activity" },
        ]
      : []),
  ];

  return <NavTabs items={items} current={current} />;
}
