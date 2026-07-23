import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  publishedBefore,
  type Page,
} from "@/lib/data/pagination";
import { deleteAnnouncementNotifications } from "@/lib/data/notifications";
import { classIdsForParent, classIdsForTeacher } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/jobs/queue";
import type { AnnouncementInput } from "@/lib/validation";

/**
 * Announcements.
 *
 * Who may write one mirrors albums: the owner writes anything, a teacher writes
 * for a class they teach, and a **nursery-wide** announcement is owner-only —
 * because it reaches every family, which is not a single teacher's call. The
 * body is markdown, rendered by `AnnouncementBody` to React elements only; it is
 * never turned into raw HTML anywhere.
 */

async function assertCanManageAnnouncement(session: Session, id: string) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  const announcement = await prisma.announcement.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      body: true,
      audience: true,
      classId: true,
      status: true,
      publishedAt: true,
      class: { select: { id: true, name: true } },
    },
  });

  if (!announcement) throw new NotFoundError();
  if (session.user.role === "OWNER") return announcement;

  // A teacher: only their own class's announcements, never a nursery-wide one.
  const classIds = await classIdsForTeacher(session.user.id);
  if (
    announcement.audience !== "CLASS" ||
    !announcement.classId ||
    !classIds.includes(announcement.classId)
  ) {
    throw new NotFoundError();
  }
  return announcement;
}

function assertAudienceAllowed(session: Session, input: AnnouncementInput) {
  if (input.audience === "ALL_NURSERY" && session.user.role !== "OWNER") {
    throw new ForbiddenError(
      "Only the nursery owner can post an announcement to the whole nursery.",
    );
  }
}

// ---------------------------------------------------------------------------
// Staff writes
// ---------------------------------------------------------------------------

export async function createAnnouncement(
  session: Session,
  input: AnnouncementInput,
) {
  if (session.user.role === "PARENT") throw new ForbiddenError();
  assertAudienceAllowed(session, input);

  if (input.audience === "CLASS") {
    if (session.user.role === "TEACHER") {
      const classIds = await classIdsForTeacher(session.user.id);
      if (!input.classId || !classIds.includes(input.classId)) {
        throw new ForbiddenError("You can only post to a class you teach.");
      }
    }
  }

  return prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      audience: input.audience,
      classId: input.audience === "CLASS" ? input.classId : null,
      authorUserId: session.user.id,
    },
    select: { id: true, title: true },
  });
}

export async function updateAnnouncement(
  session: Session,
  id: string,
  input: AnnouncementInput,
) {
  const before = await assertCanManageAnnouncement(session, id);
  assertAudienceAllowed(session, input);

  // Moving an announcement to another class, or to nursery-wide, is owner-only —
  // same reasoning as albums: it changes who it reaches.
  const audienceChanged =
    input.audience !== before.audience ||
    (input.classId ?? null) !== before.classId;
  if (audienceChanged && session.user.role !== "OWNER") {
    throw new ForbiddenError(
      "Only the owner can change who an announcement is for.",
    );
  }

  return prisma.announcement.update({
    where: { id },
    data: {
      title: input.title,
      body: input.body,
      audience: input.audience,
      classId: input.audience === "CLASS" ? input.classId : null,
    },
    select: { id: true, title: true },
  });
}

/** Publish an announcement. Returns whether it was newly published. */
export async function publishAnnouncement(session: Session, id: string) {
  const announcement = await assertCanManageAnnouncement(session, id);

  const alreadyPublished = announcement.status === "PUBLISHED";

  await prisma.announcement.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: announcement.publishedAt ?? new Date(),
    },
  });

  // Fan out only on the transition to published, and off the request — the
  // notification job is deduped on the announcement id, so a retry is harmless.
  if (!alreadyPublished) {
    await enqueue(QUEUES.notifyAnnouncement, { announcementId: id });
  }

  return { title: announcement.title, alreadyPublished };
}

export async function unpublishAnnouncement(session: Session, id: string) {
  const announcement = await assertCanManageAnnouncement(session, id);

  await prisma.announcement.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
  });

  // Withdrawing it should withdraw its notifications too — otherwise a family
  // taps a notification that leads to a feed the announcement is no longer in.
  await deleteAnnouncementNotifications(id);

  return announcement;
}

export async function deleteAnnouncement(session: Session, id: string) {
  const announcement = await assertCanManageAnnouncement(session, id);

  await prisma.announcement.update({
    where: { id },
    data: { deletedAt: new Date(), status: "DRAFT", publishedAt: null },
  });

  await deleteAnnouncementNotifications(id);

  return announcement;
}

// ---------------------------------------------------------------------------
// Staff reads
// ---------------------------------------------------------------------------

export async function listAnnouncementsForStaff(session: Session, limit = 50) {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  const scoped =
    session.user.role === "TEACHER"
      ? {
          audience: "CLASS" as const,
          classId: { in: await classIdsForTeacher(session.user.id) },
        }
      : {};

  return prisma.announcement.findMany({
    where: { deletedAt: null, ...scoped },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      audience: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
      author: { select: { name: true } },
    },
  });
}

export async function getAnnouncementForStaff(session: Session, id: string) {
  return assertCanManageAnnouncement(session, id);
}

// ---------------------------------------------------------------------------
// Parent feed
// ---------------------------------------------------------------------------

export type ParentAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  className: string | null;
  publishedAt: Date | null;
};

/**
 * The announcements a parent should see: published ones addressed to the whole
 * nursery, or to a class one of their children is in. Scope is resolved from the
 * caller's own guardianships, never the request.
 */
export async function listAnnouncementsForParent(
  session: Session,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<Page<ParentAnnouncement>> {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const limit = clampPageSize(options.limit ?? 15);
  const cursor = decodeCursor(options.cursor);
  const classIds = await classIdsForParent(session.user.id);

  const rows = await prisma.announcement.findMany({
    where: {
      AND: [
        {
          status: "PUBLISHED" as const,
          publishedAt: { not: null },
          deletedAt: null,
          OR: [
            { audience: "ALL_NURSERY" as const },
            { audience: "CLASS" as const, classId: { in: classIds } },
          ],
        },
        ...publishedBefore(cursor),
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      title: true,
      body: true,
      audience: true,
      publishedAt: true,
      class: { select: { name: true } },
    },
  });

  return buildPage(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      audience: row.audience,
      className: row.class?.name ?? null,
      publishedAt: row.publishedAt,
    })),
    limit,
    (row) => ({ at: row.publishedAt!, id: row.id }),
  );
}
