import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { assertCanManageClass, classIdsForTeacher } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import type { ClassInput } from "@/lib/validation";

/**
 * Classes.
 *
 * Only the owner creates, edits or archives a class. Teachers read the classes
 * they are assigned to and nothing else; that restriction is applied here, in
 * the query, not by hiding links in the UI.
 */

/** Slugs are used in URLs, so they must be stable, unique and readable. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "class";

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? root : `${root}-${suffix + 1}`;
    const clash = await prisma.class.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!clash || clash.id === excludeId) return candidate;
  }

  // Vanishingly unlikely; a random suffix beats throwing at the 100th "Sunflowers".
  return `${root}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listClassesForSession(session: Session) {
  const scoped =
    session.user.role === "TEACHER"
      ? { id: { in: await classIdsForTeacher(session.user.id) } }
      : {};

  if (session.user.role === "PARENT") throw new ForbiddenError();

  return prisma.class.findMany({
    where: { archivedAt: null, ...scoped },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      ageGroupKey: true,
      academicYear: true,
      _count: { select: { children: true, teachers: true } },
    },
  });
}

export async function getClassDetail(session: Session, classId: string) {
  // Throws NotFound for a teacher asking about someone else's class.
  await assertCanManageClass(session, classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      slug: true,
      ageGroupKey: true,
      academicYear: true,
      archivedAt: true,
      children: {
        where: { deletedAt: null, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          photoConsent: true,
        },
      },
      teachers: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!klass) throw new NotFoundError();
  return klass;
}

export async function createClass(session: Session, input: ClassInput) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  return prisma.class.create({
    data: {
      name: input.name,
      slug: await uniqueSlug(input.name),
      ageGroupKey: input.ageGroupKey,
      academicYear: input.academicYear,
    },
    select: { id: true, name: true, slug: true },
  });
}

export async function updateClass(
  session: Session,
  classId: string,
  input: ClassInput,
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const existing = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, ageGroupKey: true, academicYear: true },
  });
  if (!existing) throw new NotFoundError();

  const updated = await prisma.class.update({
    where: { id: classId },
    data: {
      name: input.name,
      ageGroupKey: input.ageGroupKey,
      academicYear: input.academicYear,
      // Re-slug only on a real rename, so existing links keep working.
      ...(existing.name !== input.name
        ? { slug: await uniqueSlug(input.name, classId) }
        : {}),
    },
    select: { id: true, name: true, slug: true },
  });

  return { updated, before: existing };
}

/**
 * Archive rather than delete.
 *
 * A class holds the historical association between children and photos. Deleting
 * it would orphan that history, so archiving hides it from active lists while
 * leaving the record intact.
 */
export async function archiveClass(session: Session, classId: string) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, _count: { select: { children: true } } },
  });
  if (!klass) throw new NotFoundError();

  if (klass._count.children > 0) {
    throw new ForbiddenError(
      "Move the children in this class to another class before archiving it.",
    );
  }

  await prisma.class.update({
    where: { id: classId },
    data: { archivedAt: new Date() },
  });

  return klass;
}

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------

export async function assignTeacher(
  session: Session,
  userId: string,
  classId: string,
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const [user, klass] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, deletedAt: true },
    }),
    prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, archivedAt: true },
    }),
  ]);

  if (!user || user.deletedAt || !klass || klass.archivedAt) {
    throw new NotFoundError();
  }
  if (user.role !== "TEACHER") {
    throw new ForbiddenError("Only teacher accounts can be assigned to a class.");
  }

  await prisma.teacherAssignment.upsert({
    where: { userId_classId: { userId, classId } },
    update: {},
    create: { userId, classId },
  });

  return { user, klass };
}

export async function unassignTeacher(
  session: Session,
  userId: string,
  classId: string,
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const [user, klass] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
    prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } }),
  ]);

  if (!user || !klass) throw new NotFoundError();

  await prisma.teacherAssignment
    .delete({ where: { userId_classId: { userId, classId } } })
    .catch(() => {
      // Already unassigned. Not an error.
    });

  return { user, klass };
}
