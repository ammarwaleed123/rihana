import "server-only";

import { cache } from "react";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";

/**
 * Scope resolution: the answer to "what may this person see".
 *
 * Two edges grant everything in this system:
 *
 *   Guardianship       parent -> child
 *   TeacherAssignment  teacher -> class
 *
 * There is no third path. An OWNER is scoped to the whole nursery by role, and
 * that is the only blanket grant that exists.
 *
 * Every function here is memoised per-request via React `cache`, so a page that
 * resolves a parent's children in three different components still issues one
 * query. The cache is per-request and cannot bleed across users.
 */

/** Child ids a parent is guardian of. Empty array means "sees nothing". */
export const childIdsForParent = cache(
  async (parentUserId: string): Promise<string[]> => {
    const rows = await prisma.guardianship.findMany({
      where: {
        parentUserId,
        // A guardianship over a deleted child grants nothing.
        child: { deletedAt: null },
      },
      select: { childId: true },
    });

    return rows.map((r) => r.childId);
  },
);

/**
 * Class ids a parent may see class-album content for.
 *
 * Derived strictly from where their own children are enrolled — a parent has no
 * standing relationship to a class, only to a child who happens to be in one.
 */
export const classIdsForParent = cache(
  async (parentUserId: string): Promise<string[]> => {
    const rows = await prisma.guardianship.findMany({
      where: { parentUserId, child: { deletedAt: null } },
      select: { child: { select: { classId: true } } },
    });

    const ids = new Set<string>();
    for (const row of rows) {
      if (row.child.classId) ids.add(row.child.classId);
    }
    return [...ids];
  },
);

/** Class ids a teacher is assigned to. */
export const classIdsForTeacher = cache(
  async (userId: string): Promise<string[]> => {
    const rows = await prisma.teacherAssignment.findMany({
      where: { userId, class: { archivedAt: null } },
      select: { classId: true },
    });

    return rows.map((r) => r.classId);
  },
);

/**
 * Class ids the caller may act within, whatever their role.
 *
 * `null` means "unrestricted" (owner) and is deliberately distinct from `[]`,
 * which means "restricted to nothing". Conflating the two is how an owner ends
 * up seeing zero classes, or worse, how a teacher ends up seeing all of them.
 */
export async function scopedClassIds(
  session: Session,
): Promise<string[] | null> {
  switch (session.user.role) {
    case "OWNER":
      return null;
    case "TEACHER":
      return classIdsForTeacher(session.user.id);
    case "PARENT":
      return classIdsForParent(session.user.id);
  }
}

/**
 * Assert the caller may view a child, and return it.
 *
 * Throws NotFoundError for both "no such child" and "not your child" — a
 * distinct 403 would confirm the child exists at this nursery.
 */
export async function assertCanViewChild(session: Session, childId: string) {
  const child = await prisma.child.findFirst({
    where: { id: childId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      classId: true,
      status: true,
      photoConsent: true,
    },
  });

  if (!child) throw new NotFoundError();

  switch (session.user.role) {
    case "OWNER":
      return child;

    case "TEACHER": {
      const classIds = await classIdsForTeacher(session.user.id);
      if (!child.classId || !classIds.includes(child.classId)) {
        throw new NotFoundError();
      }
      return child;
    }

    case "PARENT": {
      const childIds = await childIdsForParent(session.user.id);
      if (!childIds.includes(child.id)) throw new NotFoundError();
      return child;
    }
  }
}

/**
 * Assert the caller may *manage* a class (create/edit content within it).
 *
 * Parents can never manage a class, regardless of enrolment — this throws
 * Forbidden rather than NotFound for them, because class existence is not a
 * secret from a parent whose child attends.
 */
export async function assertCanManageClass(session: Session, classId: string) {
  const klass = await prisma.class.findFirst({
    where: { id: classId, archivedAt: null },
    select: { id: true, name: true, slug: true, ageGroupKey: true },
  });

  if (!klass) throw new NotFoundError();

  switch (session.user.role) {
    case "OWNER":
      return klass;

    case "TEACHER": {
      const classIds = await classIdsForTeacher(session.user.id);
      if (!classIds.includes(klass.id)) throw new NotFoundError();
      return klass;
    }

    case "PARENT":
      throw new ForbiddenError();
  }
}
