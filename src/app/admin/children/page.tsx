import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import {
  Badge,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { listChildren } from "@/lib/data/children";
import { listClassesForSession } from "@/lib/data/classes";

import { CreateChildForm } from "./child-forms";

export const metadata: Metadata = {
  title: "Children",
  robots: { index: false, follow: false },
};

function ageFrom(dateOfBirth: Date): string {
  const months = Math.floor(
    (Date.now() - dateOfBirth.getTime()) / (30.44 * 24 * 3600 * 1000),
  );
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr`;
}

export default async function ChildrenPage({
  searchParams,
}: {
  searchParams: Promise<{
    classId?: string;
    q?: string;
    cursor?: string;
    archived?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await requireStaff("/admin/children");
  const isOwner = session.user.role === "OWNER";

  // Both reads are scoped: a teacher sees only their assigned classes and only
  // the children inside them.
  const [classes, page] = await Promise.all([
    listClassesForSession(session),
    listChildren(session, {
      classId: params.classId ?? null,
      search: params.q ?? null,
      cursor: params.cursor ?? null,
      includeArchived: params.archived === "1",
    }),
  ]);

  const activeFilter = params.classId
    ? classes.find((c) => c.id === params.classId)
    : undefined;

  return (
    <div>
      <AdminNav current="/admin/children" role={session.user.role} />

      <PageHeader
        title="Children"
        description={
          isOwner
            ? "Everyone enrolled at the nursery."
            : "Children in the classes you are assigned to."
        }
        action={isOwner ? <CreateChildForm classes={classes} /> : undefined}
      />

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3"
        role="search"
      >
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-bold">
            Search by name
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Laila"
            className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none"
          />
        </div>

        <div className="min-w-44">
          <label htmlFor="classId" className="mb-1.5 block text-sm font-bold">
            Class
          </label>
          <select
            id="classId"
            name="classId"
            defaultValue={params.classId ?? ""}
            className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 pb-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={params.archived === "1"}
            className="size-4 accent-[color:var(--color-leaf)]"
          />
          Include children who have left
        </label>

        <button
          type="submit"
          className="rounded-full border-2 border-ink/15 bg-card px-5 py-3 font-bold transition-colors hover:border-leaf hover:text-leaf"
        >
          Filter
        </button>
      </form>

      {activeFilter ? (
        <p className="mb-4 text-sm text-ink-soft">
          Showing <span className="font-bold">{activeFilter.name}</span> ·{" "}
          <Link href="/admin/children" className="text-leaf underline underline-offset-2">
            clear filter
          </Link>
        </p>
      ) : null}

      {page.items.length === 0 ? (
        <EmptyState
          title="No children found"
          description={
            params.q || params.classId
              ? "Nothing matches those filters. Try clearing them."
              : isOwner
                ? "Add your first child to get started."
                : "No children are enrolled in your classes yet."
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Age</Th>
                <Th>Class</Th>
                <Th>Guardians</Th>
                <Th>Photos</Th>
                {isOwner ? <Th>{""}</Th> : null}
              </tr>
            </thead>
            <tbody>
              {page.items.map((child) => (
                <tr key={child.id}>
                  <Td>
                    <span className="font-semibold">
                      {child.firstName} {child.lastName}
                    </span>
                    {child.status === "ARCHIVED" ? (
                      <span className="ml-2">
                        <Badge tone="neutral">Left</Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-soft">{ageFrom(child.dateOfBirth)}</Td>
                  <Td>
                    {child.class ? (
                      child.class.name
                    ) : (
                      <span className="text-ink-faint">Unassigned</span>
                    )}
                  </Td>
                  <Td>
                    {child.guardians.length === 0 ? (
                      // Worth flagging: a child with no guardian has photos that
                      // reach nobody.
                      <Badge tone="yellow">None linked</Badge>
                    ) : (
                      <span className="text-sm text-ink-soft">
                        {child.guardians.map((g) => g.name).join(", ")}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {child.photoConsent ? (
                      <Badge tone="green">Consent given</Badge>
                    ) : (
                      <Badge tone="coral">No consent</Badge>
                    )}
                  </Td>
                  {isOwner ? (
                    <Td>
                      <Link
                        href={`/admin/children/${child.id}`}
                        className="font-semibold text-leaf underline underline-offset-4"
                      >
                        Manage
                      </Link>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>

          {page.hasMore && page.nextCursor ? (
            <div className="mt-6 text-center">
              <Link
                href={{
                  pathname: "/admin/children",
                  query: { ...params, cursor: page.nextCursor },
                }}
                className="inline-block rounded-full border-2 border-ink/15 bg-card px-6 py-3 font-bold transition-colors hover:border-leaf hover:text-leaf"
              >
                Load more
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
