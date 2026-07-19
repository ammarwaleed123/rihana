import "server-only";

import { ForbiddenError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  type Page,
} from "@/lib/data/pagination";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";

/**
 * Reading the audit log.
 *
 * Owner-only. The log records who granted whom access to which child's
 * photographs, so it is itself sensitive — a teacher does not get to browse it.
 *
 * There is no write path here beyond recordAudit, and no update or delete path
 * anywhere. See lib/data/audit.ts.
 */

export type ActivityItem = {
  id: string;
  action: string;
  summary: string;
  createdAt: Date;
  actorName: string | null;
  actorRole: string | null;
};

export async function listActivity(
  session: Session,
  options: { cursor?: string | null; limit?: number; childId?: string } = {},
): Promise<Page<ActivityItem>> {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const limit = clampPageSize(options.limit ?? 50);
  const cursor = decodeCursor(options.cursor);

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(options.childId ? { childId: options.childId } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.at } },
              { createdAt: cursor.at, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      actorRole: true,
      actor: { select: { name: true } },
    },
  });

  return buildPage(
    rows.map((row) => ({
      id: row.id,
      action: row.action,
      summary: row.summary,
      createdAt: row.createdAt,
      actorName: row.actor?.name ?? null,
      actorRole: row.actorRole,
    })),
    limit,
    (row) => ({ at: row.createdAt, id: row.id }),
  );
}

/** Counts for the admin overview. One round trip, not five. */
export async function getOverviewStats(session: Session) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const [children, classes, parents, pendingInvites, unlinkedChildren] =
    await Promise.all([
      prisma.child.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.class.count({ where: { archivedAt: null } }),
      prisma.user.count({
        where: { role: "PARENT", deletedAt: null, status: "ACTIVE" },
      }),
      prisma.user.count({ where: { status: "INVITED", deletedAt: null } }),
      // Children nobody can see photos of — the most useful warning on the page.
      prisma.child.count({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          guardianships: { none: {} },
        },
      }),
    ]);

  return { children, classes, parents, pendingInvites, unlinkedChildren };
}
