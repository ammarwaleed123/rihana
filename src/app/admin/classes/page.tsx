import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
} from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { fill, plural } from "@/lib/i18n/plural";
import { listClassesForSession } from "@/lib/data/classes";
import { listPeople } from "@/lib/data/people";
import { ageGroupLabels, type AGE_GROUPS } from "@/lib/validation";

import {
  ArchiveClassButton,
  AssignTeacherForm,
  CreateClassForm,
  UnassignTeacherButton,
} from "./class-forms";

export const metadata: Metadata = {
  title: "Classes",
  robots: { index: false, follow: false },
};

export default async function ClassesPage() {
  const session = await requireStaff("/admin/classes");
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin.classes;
  const isOwner = session.user.role === "OWNER";

  const classes = await listClassesForSession(session);

  // Only the owner manages assignments, so the teacher roster is only fetched
  // for them — a teacher has no business enumerating staff.
  const teachers = isOwner
    ? await listPeople(session, { role: "TEACHER" })
    : [];

  return (
    <div>
      <AdminNav current="/admin/classes" role={session.user.role} t={dict.admin.nav} />

      <PageHeader
        title={t.title}
        description={
          isOwner ? t.descOwner : t.descTeacher
        }
        action={isOwner ? <CreateClassForm t={t} /> : undefined}
      />

      {classes.length === 0 ? (
        <EmptyState
          title={isOwner ? "No classes yet" : "You are not assigned to a class"}
          description={
            isOwner
              ? "Create your first class, then add children to it."
              : "Ask the nursery owner to assign you to a class."
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {classes.map((klass) => {
            const assignedIds = new Set<string>();
            const unassigned = teachers.filter((t) => {
              const isHere = t.classes.some((c) => c.id === klass.id);
              if (isHere) assignedIds.add(t.id);
              return !isHere;
            });

            const assigned = teachers.filter((t) => assignedIds.has(t.id));

            return (
              <Card key={klass.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">
                      {klass.name}
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">
                      {ageGroupLabels[
                        klass.ageGroupKey as (typeof AGE_GROUPS)[number]
                      ] ?? klass.ageGroupKey}{" "}
                      · {klass.academicYear}
                    </p>
                  </div>
                  {isOwner ? (
                    <ArchiveClassButton t={t}
                      classId={klass.id}
                      className={klass.name}
                    />
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="green">
                    {klass._count.children}{" "}
                    {klass._count.children === 1 ? "child" : "children"}
                  </Badge>
                  <Badge tone="sky">
                    {plural(t.teacherCount, klass._count.teachers, locale)}
                  </Badge>
                </div>

                <p className="mt-4">
                  <Link
                    href={`/admin/children?classId=${klass.id}`}
                    className="font-semibold text-leaf underline underline-offset-4"
                  >
                    {fill(t.viewChildrenIn, { name: klass.name })}
                  </Link>
                </p>

                {isOwner ? (
                  <div className="mt-6 border-t border-ink/10 pt-5">
                    <SectionTitle>{t.teachers}</SectionTitle>

                    {assigned.length > 0 ? (
                      <ul className="mb-4 space-y-2">
                        {assigned.map((teacher) => (
                          <li
                            key={teacher.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span>
                              <span className="font-semibold">{teacher.name}</span>{" "}
                              <span className="text-ink-faint">{teacher.email}</span>
                            </span>
                            <UnassignTeacherButton
                              t={t}
                              classId={klass.id}
                              userId={teacher.id}
                              teacherName={teacher.name}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mb-4 text-sm text-ink-faint">
                        {t.noTeacherAssigned}
                      </p>
                    )}

                    <AssignTeacherForm t={t} classId={klass.id} teachers={unassigned} />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
