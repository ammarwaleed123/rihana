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
  | "pickup_person.updated";

export type AuditEntry = {
  action: AuditAction;
  targetType: string;
  targetId: string;
  summary: string;
  /** Set whenever the action concerns a child — enables per-child history. */
  childId?: string | null;
  actor?: { id: string; role: Role } | null;
  metadata?: Prisma.InputJsonValue | null;
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
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        summary: entry.summary,
        childId: entry.childId ?? null,
        actorUserId: entry.actor?.id ?? null,
        actorRole: entry.actor?.role ?? null,
        metadata: (scrub(entry.metadata ?? null) ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ipHash: entry.ipHash ?? null,
        userAgent: entry.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    reportError(error, {
      scope: "audit",
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
    });
  }
}
