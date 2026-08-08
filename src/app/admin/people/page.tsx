import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { LiveSearch } from "@/components/admin/live-search";
import {
  Badge,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  SectionTitle,
  Table,
  Td,
  Th,
} from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { listChildren } from "@/lib/data/children";
import { listClassesForSession } from "@/lib/data/classes";
import { listPeople } from "@/lib/data/people";

import {
  InviteParentForm,
  InviteTeacherForm,
  ReissueInviteButton,
  TogglePersonButton,
} from "./people-forms";

export const metadata: Metadata = {
  title: "Parents & staff",
  robots: { index: false, follow: false },
};

function statusBadge(status: "INVITED" | "ACTIVE" | "DISABLED") {
  if (status === "ACTIVE") return <Badge tone="green">Active</Badge>;
  if (status === "INVITED") return <Badge tone="yellow">Invite pending</Badge>;
  return <Badge tone="coral">Disabled</Badge>;
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const session = await requireStaff("/admin/people");
  const dict = await getDictionary(await getAppLocale());

  // Account management is owner-only. A teacher who navigates here directly is
  // sent back rather than shown a page they cannot use.
  if (session.user.role !== "OWNER") redirect("/admin");

  const [people, classes, childPage] = await Promise.all([
    listPeople(session, { search: params.q ?? null }),
    listClassesForSession(session),
    listChildren(session, { limit: 100 }),
  ]);

  const parents = people.filter((p) => p.role === "PARENT");
  const staff = people.filter((p) => p.role !== "PARENT");

  return (
    <div>
      <AdminNav current="/admin/people" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title="Parents & staff"
        description="Accounts are created here. Nobody can sign themselves up."
      />

      <div className="mb-8 flex flex-wrap gap-3">
        <InviteParentForm childOptions={childPage.items} />
        <InviteTeacherForm classes={classes} />
      </div>

      <LiveSearch basePath="/admin/people" placeholder="Name or email" />

      <section className="mb-10">
        <SectionTitle>Staff ({staff.length})</SectionTitle>

        {staff.length === 0 ? (
          <EmptyState
            title="No staff accounts"
            description="Invite a teacher to let them upload and tag photos for their class."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Classes</Th>
                <Th>Status</Th>
                <Th>Last signed in</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => (
                <tr key={person.id}>
                  <Td>
                    <span className="font-semibold">{person.name}</span>
                    <span className="block text-sm text-ink-faint">
                      {person.email}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={person.role === "OWNER" ? "sky" : "neutral"}>
                      {person.role === "OWNER" ? "Owner" : "Teacher"}
                    </Badge>
                  </Td>
                  <Td className="text-sm text-ink-soft">
                    {person.classes.length > 0
                      ? person.classes.map((c) => c.name).join(", ")
                      : person.role === "OWNER"
                        ? "All classes"
                        : "None yet"}
                  </Td>
                  <Td>{statusBadge(person.status)}</Td>
                  <Td className="text-sm text-ink-soft">
                    {person.lastLoginAt
                      ? person.lastLoginAt.toISOString().slice(0, 10)
                      : "Never"}
                  </Td>
                  <Td>
                    <div className="space-y-2">
                      {person.status === "INVITED" ? (
                        <ReissueInviteButton userId={person.id} />
                      ) : null}
                      {person.id === session.user.id ? (
                        <span className="text-sm text-ink-faint">You</span>
                      ) : (
                        <TogglePersonButton
                          userId={person.id}
                          name={person.name}
                          disabled={person.status === "DISABLED"}
                        />
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <CardList>
          {staff.map((person) => (
            <CardListItem
              key={person.id}
              title={person.name}
              badges={statusBadge(person.status)}
              fields={[
                { label: "Email", value: person.email },
                {
                  label: "Role",
                  value: person.role === "OWNER" ? "Owner" : "Teacher",
                },
                {
                  label: "Classes",
                  value:
                    person.classes.length > 0
                      ? person.classes.map((c) => c.name).join(", ")
                      : person.role === "OWNER"
                        ? "All classes"
                        : "None yet",
                },
              ]}
              action={
                person.id === session.user.id ? (
                  <span className="text-sm text-ink-faint">This is you</span>
                ) : (
                  <div className="space-y-2">
                    {person.status === "INVITED" ? (
                      <ReissueInviteButton userId={person.id} />
                    ) : null}
                    <TogglePersonButton
                      userId={person.id}
                      name={person.name}
                      disabled={person.status === "DISABLED"}
                    />
                  </div>
                )
              }
            />
          ))}
        </CardList>
      </section>

      <section>
        <SectionTitle>Parents ({parents.length})</SectionTitle>

        {parents.length === 0 ? (
          <EmptyState
            title="No parent accounts"
            description="Invite a parent and link them to their child so they can see photos."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Children</Th>
                <Th>Status</Th>
                <Th>Last signed in</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {parents.map((person) => (
                <tr key={person.id}>
                  <Td>
                    <span className="font-semibold">{person.name}</span>
                    <span className="block text-sm text-ink-faint">
                      {person.email}
                    </span>
                  </Td>
                  <Td className="text-sm text-ink-soft">
                    {person.children.length > 0 ? (
                      person.children
                        .map((c) => `${c.firstName} ${c.lastName}`)
                        .join(", ")
                    ) : (
                      // A parent with no linked child sees an empty portal.
                      <Badge tone="yellow">No children linked</Badge>
                    )}
                  </Td>
                  <Td>{statusBadge(person.status)}</Td>
                  <Td className="text-sm text-ink-soft">
                    {person.lastLoginAt
                      ? person.lastLoginAt.toISOString().slice(0, 10)
                      : "Never"}
                  </Td>
                  <Td>
                    <div className="space-y-2">
                      {person.status === "INVITED" ? (
                        <ReissueInviteButton userId={person.id} />
                      ) : null}
                      <TogglePersonButton
                        userId={person.id}
                        name={person.name}
                        disabled={person.status === "DISABLED"}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <CardList>
          {parents.map((person) => (
            <CardListItem
              key={person.id}
              title={person.name}
              badges={statusBadge(person.status)}
              fields={[
                { label: "Email", value: person.email },
                {
                  label: "Children",
                  value:
                    person.children.length > 0 ? (
                      person.children
                        .map((c) => `${c.firstName} ${c.lastName}`)
                        .join(", ")
                    ) : (
                      <Badge tone="yellow">No children linked</Badge>
                    ),
                },
              ]}
              action={
                <div className="space-y-2">
                  {person.status === "INVITED" ? (
                    <ReissueInviteButton userId={person.id} />
                  ) : null}
                  <TogglePersonButton
                    userId={person.id}
                    name={person.name}
                    disabled={person.status === "DISABLED"}
                  />
                </div>
              }
            />
          ))}
        </CardList>
      </section>
    </div>
  );
}
