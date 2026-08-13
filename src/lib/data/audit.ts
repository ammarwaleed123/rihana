import "server-only";

import type { Prisma, Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/logger";

/**
 * Append-only audit log.
 *
 * Nothing in this module updates or deletes. If an audit trail can be edited by
 * the application that writes it, it is not evidence of anything.
 */

/**
 * Actions worth recording. A closed union rather than free-form strings so that
 * a typo cannot silently create a new, unqueryable action name.
 */
export type AuditAction =
  // authentication
  | "auth.signed_in"
  | "auth.signed_out"
  | "auth.sign_in_failed"
  | "auth.password_changed"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "auth.invite_accepted"
  | "auth.email_changed"
  // people
  | "user.invited"
  | "user.disabled"
  | "user.reenabled"
  | "user.role_changed"
  | "child.created"
  | "child.updated"
  | "child.archived"
  | "child.deleted"
  | "guardianship.created"
  | "guardianship.removed"
  | "class.created"
  | "class.updated"
  | "class.archived"
  | "teacher.assigned"
  | "teacher.unassigned"
  // content
  | "photo.published"
  | "photo.deleted"
  | "photo.tagged"
  | "photo.untagged"
  | "album.created"
  | "album.published"
  | "announcement.published"
  // pickup
  | "pickup_person.created"
  | "pickup_person.approved"
  | "pickup_person.rejected"
  | "pickup_person.revoked"
  | "pickup_person.updated"
  | "pickup_method.changed"
  // daily reports
  | "daily_report.published"
  | "daily_report.updated"
  | "daily_report.absent"
  | "daily_report.acknowledged";

export type AuditEntry = {
  action: AuditAction;
  targetType: string;
  targetId: string;
  summary: string;
  /** Set whenever the action concerns a child — enables per-child history. */
  childId?: string | null;
  actor?: { id: string; role: Role } | null;
  /**
   * Arbitrary structured context (before/after diffs, counts).
   *
   * Typed loosely on purpose so callers can pass plain objects; it is scrubbed
   * and cast to Prisma's JSON type at the write below. Never put a token,
   * password hash or signed URL in here — see REDACTED_KEYS.
   */
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
  userAgent?: string | null;
};

/**
 * Keys that must never reach the audit table.
 *
 * Audit metadata is written from diff objects, and a diff of a user record would
 * otherwise happily include the password hash.
 */
const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "invitetokenhash",
  "resettokenhash",
  "sessiontoken",
  "secret",
  "apikey",
  "accesskey",
]);

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = REDACTED_KEYS.has(key.toLowerCase())
      ? "[redacted]"
      : scrub(nested, depth + 1);
  }
  return output;
}

/**
 * Write an audit row.
 *
 * Never throws. An audit write failing must not roll back the action it
 * describes or hand the user an error — but it must be loud in the logs,
 * because a silent gap in the trail is worse than a noisy one.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const data = {
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    summary: entry.summary,
    actorUserId: entry.actor?.id ?? null,
    actorRole: entry.actor?.role ?? null,
    // Scrubbed above; the cast is the boundary between our loose input type
    // and Prisma's JSON type.
    metadata: entry.metadata
      ? (scrub(entry.metadata) as Prisma.InputJsonValue)
      : undefined,
    ipHash: entry.ipHash ?? null,
    userAgent: entry.userAgent?.slice(0, 255) ?? null,
  };

  try {
    await prisma.auditLog.create({
      data: { ...data, childId: entry.childId ?? null },
    });
    return;
  } catch (error) {
    // `childId` is a foreign key, so it fails if the child was deleted in the
    // same operation being audited. Losing the whole row over that would mean
    // an erasure completes with no record of it — the single action that most
    // needs one. Retry without the association; `targetId` and the summary
    // still identify what happened.
    const isForeignKeyViolation =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2003";

    if (entry.childId && isForeignKeyViolation) {
      try {
        await prisma.auditLog.create({ data: { ...data, childId: null } });
        return;
      } catch (retryError) {
        reportError(retryError, { scope: "audit-retry", action: entry.action });
      }
    } else {
      reportError(error, {
        scope: "audit",
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
      });
    }
  }
}
