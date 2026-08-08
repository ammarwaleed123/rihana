import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import {
  Badge,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { listActivity } from "@/lib/data/activity";

export const metadata: Metadata = {
  title: "Activity",
  robots: { index: false, follow: false },
};

/** Actions that change who can see a child's photographs. */
const ACCESS_ACTIONS = new Set([
  "guardianship.created",
  "guardianship.removed",
  "teacher.assigned",
  "teacher.unassigned",
  "child.deleted",
  "user.disabled",
]);

function toneFor(action: string) {
  if (ACCESS_ACTIONS.has(action)) return "coral" as const;
  if (action.startsWith("auth.sign_in_failed")) return "yellow" as const;
  return "neutral" as const;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const session = await requireStaff("/admin/activity");
  const dict = await getDictionary(await getAppLocale());
  if (session.user.role !== "OWNER") redirect("/admin");

  const page = await listActivity(session, { cursor: params.cursor ?? null });

  return (
    <div>
      <AdminNav current="/admin/activity" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title="Activity"
        description="Every change to accounts, children and access. This record cannot be edited or deleted."
      />

      {page.items.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Actions taken in the admin panel will appear here."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((item) => (
                <tr key={item.id}>
                  <Td className="whitespace-nowrap text-sm text-ink-soft">
                    {item.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </Td>
                  <Td className="text-sm">
                    {item.actorName ?? (
                      <span className="text-ink-faint">System</span>
                    )}
                    {item.actorRole ? (
                      <span className="block text-xs text-ink-faint">
                        {item.actorRole.toLowerCase()}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="mr-2">
                      <Badge tone={toneFor(item.action)}>
                        {item.action.split(".")[0]}
                      </Badge>
                    </span>
                    {item.summary}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <CardList>
            {page.items.map((item) => (
              <CardListItem
                key={item.id}
                title={item.summary}
                badges={
                  <Badge tone={toneFor(item.action)}>
                    {item.action.split(".")[0]}
                  </Badge>
                }
                fields={[
                  {
                    label: "When",
                    value: item.createdAt
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " "),
                  },
                  {
                    label: "Who",
                    value: item.actorName ?? "System",
                  },
                ]}
              />
            ))}
          </CardList>

          {page.hasMore && page.nextCursor ? (
            <div className="mt-6 text-center">
              <Link
                href={{
                  pathname: "/admin/activity",
                  query: { cursor: page.nextCursor },
                }}
                className="inline-block rounded-full border-2 border-ink/15 bg-card px-6 py-3 font-bold transition-colors hover:border-leaf hover:text-leaf"
              >
                Load older
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
