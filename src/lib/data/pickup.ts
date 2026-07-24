import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  isActivePickup,
  isExpired,
  type PickupMethodValue,
  type PickupStatusValue,
} from "@/lib/data/pickup-rules";
import { assertCanViewChild, classIdsForTeacher } from "@/lib/data/scope";
import { childIdsForParent } from "@/lib/data/scope";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import type { PickupPersonInput } from "@/lib/validation";

// Re-exported so existing importers (and the door board) keep one entry point.
export { isActivePickup, isExpired };
export type { PickupMethodValue, PickupStatusValue };

/**
 * Pickup authorization.
 *
 * The safety-critical zone: who a child may be released to. Two independent
 * controls stand between "a parent typed a name" and "staff hand a child over":
 *
 *   1. A pickup person is created PENDING and is inert — it appears on no door
 *      board — until an OWNER approves it. Approval is the gate here, exactly as
 *      publishing is the gate for a photo.
 *   2. Adding or editing one requires the parent to re-enter their password
 *      (enforced in the server action, §29), so a borrowed unlocked phone cannot
 *      quietly authorize a stranger.
 *
 * Separately, a child's `pickupMethod` records whether they are collected at the
 * door (HANDOVER — needs approved people) or go home on the nursery bus (BUS —
 * the nursery's own vehicle, so no per-person approval). The parent chooses it.
 *
 * Every read here authorizes through `assertCanViewChild`, the same edge the
 * photo pages use — a parent reaches only their own children, a teacher only
 * their classes, an owner everyone.
 */

export type PickupPersonItem = {
  id: string;
  childId: string;
  fullName: string;
  relationship: string;
  phone: string;
  status: PickupStatusValue;
  hasPhoto: boolean;
  expiresAt: Date | null;
  isExpired: boolean;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

function toItem(
  row: {
    id: string;
    childId: string;
    fullName: string;
    relationship: string;
    phone: string;
    status: PickupStatusValue;
    photoThumbKey: string | null;
    photoStorageKey: string | null;
    expiresAt: Date | null;
    rejectionReason: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  },
  now: Date,
): PickupPersonItem {
  return {
    id: row.id,
    childId: row.childId,
    fullName: row.fullName,
    relationship: row.relationship,
    phone: row.phone,
    status: row.status,
    hasPhoto: Boolean(row.photoThumbKey || row.photoStorageKey),
    expiresAt: row.expiresAt,
    isExpired: isExpired(row.expiresAt, now),
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
  };
}

const personSelect = {
  id: true,
  childId: true,
  fullName: true,
  relationship: true,
  phone: true,
  status: true,
  photoThumbKey: true,
  photoStorageKey: true,
  expiresAt: true,
  rejectionReason: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.PickupPersonSelect;

// ---------------------------------------------------------------------------
// Parent-facing reads
// ---------------------------------------------------------------------------

/** A parent's children with their pickup arrangement, for the overview page. */
export async function getParentPickupSummary(session: Session) {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const childIds = await childIdsForParent(session.user.id);
  if (childIds.length === 0) return [];

  const now = new Date();
  const children = await prisma.child.findMany({
    where: { id: { in: childIds }, deletedAt: null },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      pickupMethod: true,
      class: { select: { name: true } },
      pickupPersons: {
        where: { deletedAt: null },
        select: { status: true, expiresAt: true },
      },
    },
  });

  return children.map((child) => ({
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    className: child.class?.name ?? null,
    method: child.pickupMethod as PickupMethodValue,
    approvedCount: child.pickupPersons.filter((p) =>
      isActivePickup(
        { status: p.status as PickupStatusValue, expiresAt: p.expiresAt },
        now,
      ),
    ).length,
    pendingCount: child.pickupPersons.filter((p) => p.status === "PENDING")
      .length,
  }));
}

/** One child's full pickup detail — method plus every non-removed person. */
export async function getChildPickupDetail(session: Session, childId: string) {
  await assertCanViewChild(session, childId);

  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      pickupMethod: true,
      class: { select: { name: true } },
    },
  });
  if (!child) throw new NotFoundError();

  const now = new Date();
  const rows = await prisma.pickupPerson.findMany({
    where: { childId, deletedAt: null },
    // Pending first (they want the parent's and owner's attention), then newest.
    orderBy: [{ createdAt: "desc" }],
    select: personSelect,
  });

  return {
    child: {
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
      className: child.class?.name ?? null,
      method: child.pickupMethod as PickupMethodValue,
    },
    people: rows.map((row) => toItem(row, now)),
  };
}

// ---------------------------------------------------------------------------
// Parent-facing writes (re-authentication is enforced in the server action)
// ---------------------------------------------------------------------------

/** Create a pickup person, PENDING and inert until an owner approves it. */
export async function addPickupPerson(
  session: Session,
  childId: string,
  input: PickupPersonInput,
) {
  if (session.user.role !== "PARENT") throw new ForbiddenError();
  // Parent path checks guardianship; a child that is not theirs is a 404.
  await assertCanViewChild(session, childId);

  return prisma.pickupPerson.create({
    data: {
      childId,
      fullName: input.fullName,
      relationship: input.relationship,
      phone: input.phone,
      expiresAt: input.expiresAt ?? null,
      status: "PENDING",
      addedByUserId: session.user.id,
    },
    select: { id: true, childId: true, fullName: true },
  });
}

/**
 * Edit a pickup person. Any edit returns them to PENDING.
 *
 * The owner approved a specific person with specific details; changing the name
 * or number could substitute a different person entirely, so an edit re-opens
 * review rather than silently keeping the old approval. This is deliberate and
 * on the safe side of the trade-off.
 */
export async function updatePickupPerson(
  session: Session,
  pickupPersonId: string,
  input: PickupPersonInput,
) {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const person = await prisma.pickupPerson.findFirst({
    where: { id: pickupPersonId, deletedAt: null },
    select: { id: true, childId: true, status: true },
  });
  if (!person) throw new NotFoundError();
  await assertCanViewChild(session, person.childId);

  const updated = await prisma.pickupPerson.update({
    where: { id: pickupPersonId },
    data: {
      fullName: input.fullName,
      relationship: input.relationship,
      phone: input.phone,
      expiresAt: input.expiresAt ?? null,
      status: "PENDING",
      reviewedByUserId: null,
      reviewedAt: null,
      rejectionReason: null,
    },
    select: { id: true, childId: true, fullName: true },
  });

  return { ...updated, wasApproved: person.status === "APPROVED" };
}

/**
 * Store the processed photo for a pickup person.
 *
 * Called by the add/edit action after it has re-encoded the upload — the id only
 * exists once the row does, so the photo is a second step. Authorization has
 * already happened in the create/update above; this only ever runs against an id
 * that action just produced.
 */
export async function attachPickupPhoto(
  pickupPersonId: string,
  photoStorageKey: string,
  photoThumbKey: string,
): Promise<void> {
  await prisma.pickupPerson.update({
    where: { id: pickupPersonId },
    data: { photoStorageKey, photoThumbKey },
  });
}

/**
 * Remove a pickup person a parent no longer wants authorized.
 *
 * Soft-deleted (and marked REVOKED) rather than erased: the audit trail must
 * still show that this person was once authorized and by whom. Returns the
 * storage keys so the caller can purge the photo.
 */
export async function revokePickupPerson(
  session: Session,
  pickupPersonId: string,
) {
  if (session.user.role !== "PARENT") throw new ForbiddenError();

  const person = await prisma.pickupPerson.findFirst({
    where: { id: pickupPersonId, deletedAt: null },
    select: {
      id: true,
      childId: true,
      fullName: true,
      photoStorageKey: true,
      photoThumbKey: true,
    },
  });
  if (!person) throw new NotFoundError();
  await assertCanViewChild(session, person.childId);

  await prisma.pickupPerson.update({
    where: { id: pickupPersonId },
    data: { status: "REVOKED", deletedAt: new Date() },
  });

  return person;
}

/** Choose how a child leaves at the end of the day. Guardians only. */
export async function setPickupMethod(
  session: Session,
  childId: string,
  method: PickupMethodValue,
) {
  if (session.user.role !== "PARENT") throw new ForbiddenError();
  await assertCanViewChild(session, childId);

  const before = await prisma.child.findUnique({
    where: { id: childId },
    select: { pickupMethod: true, firstName: true },
  });
  if (!before) throw new NotFoundError();

  await prisma.child.update({
    where: { id: childId },
    data: { pickupMethod: method },
  });

  return {
    childId,
    firstName: before.firstName,
    before: before.pickupMethod as PickupMethodValue,
    after: method,
  };
}

// ---------------------------------------------------------------------------
// Owner: the approval queue
// ---------------------------------------------------------------------------

export async function getPendingPickupApprovals(session: Session) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const now = new Date();
  const rows = await prisma.pickupPerson.findMany({
    where: { status: "PENDING", deletedAt: null },
    // Oldest first: this is a work queue, and the first request in should be the
    // first reviewed. Backed by the (status, createdAt) index.
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      fullName: true,
      relationship: true,
      phone: true,
      photoThumbKey: true,
      expiresAt: true,
      createdAt: true,
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          class: { select: { name: true } },
        },
      },
      addedBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    relationship: row.relationship,
    phone: row.phone,
    hasPhoto: Boolean(row.photoThumbKey),
    expiresAt: row.expiresAt,
    isExpired: isExpired(row.expiresAt, now),
    createdAt: row.createdAt,
    child: {
      id: row.child.id,
      firstName: row.child.firstName,
      lastName: row.child.lastName,
      className: row.child.class?.name ?? null,
    },
    requestedBy: row.addedBy?.name ?? "A parent",
  }));
}

/** How many pickup people await review. Owners only; 0 for anyone else. */
export async function countPendingPickupApprovals(
  session: Session,
): Promise<number> {
  if (session.user.role !== "OWNER") return 0;
  return prisma.pickupPerson.count({
    where: { status: "PENDING", deletedAt: null },
  });
}

/**
 * Approve a pending pickup person.
 *
 * The status is re-checked inside the write (`where: { ..., status: "PENDING" }`)
 * so two owners clicking at once cannot both "win" — the second updates nothing.
 * Returns the person for the audit entry and the parent notification.
 */
export async function approvePickupPerson(
  session: Session,
  pickupPersonId: string,
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const person = await prisma.pickupPerson.findFirst({
    where: { id: pickupPersonId, deletedAt: null },
    select: {
      id: true,
      status: true,
      fullName: true,
      addedByUserId: true,
      child: { select: { id: true, firstName: true } },
    },
  });
  if (!person) throw new NotFoundError();

  const result = await prisma.pickupPerson.updateMany({
    where: { id: pickupPersonId, status: "PENDING", deletedAt: null },
    data: {
      status: "APPROVED",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
      rejectionReason: null,
    },
  });

  return { person, changed: result.count > 0 };
}

/** Turn down a pending pickup person, with an optional reason for the parent. */
export async function rejectPickupPerson(
  session: Session,
  pickupPersonId: string,
  reason: string | undefined,
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const person = await prisma.pickupPerson.findFirst({
    where: { id: pickupPersonId, deletedAt: null },
    select: {
      id: true,
      status: true,
      fullName: true,
      addedByUserId: true,
      child: { select: { id: true, firstName: true } },
    },
  });
  if (!person) throw new NotFoundError();

  const result = await prisma.pickupPerson.updateMany({
    where: { id: pickupPersonId, status: "PENDING", deletedAt: null },
    data: {
      status: "REJECTED",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
      rejectionReason: reason ?? null,
    },
  });

  return { person, changed: result.count > 0 };
}

// ---------------------------------------------------------------------------
// Staff: the day-of door board
// ---------------------------------------------------------------------------

export type DoorBoardChild = {
  id: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  className: string | null;
  method: PickupMethodValue;
  people: Array<{
    id: string;
    fullName: string;
    relationship: string;
    phone: string;
    hasPhoto: boolean;
    expiresAt: Date | null;
  }>;
};

/**
 * "Who may collect whom, right now."
 *
 * The screen a teacher holds at the door. Every active child, scoped to what the
 * caller may see (a teacher's classes; everyone for the owner), each showing
 * either the nursery-bus badge or their currently-valid approved people. Expired
 * authorizations are filtered here, not in SQL, so the board reflects today
 * without a cron job rewriting rows.
 */
export async function getDoorBoard(
  session: Session,
  options: { classId?: string | null } = {},
): Promise<DoorBoardChild[]> {
  if (session.user.role === "PARENT") throw new ForbiddenError();

  let scopeFilter: Prisma.ChildWhereInput = {};
  if (session.user.role === "TEACHER") {
    const classIds = await classIdsForTeacher(session.user.id);
    // Empty assignment list must match nothing, not everything.
    scopeFilter = { classId: { in: classIds } };
  }
  const explicit = options.classId ? { classId: options.classId } : {};

  const now = new Date();
  const children = await prisma.child.findMany({
    where: { AND: [{ deletedAt: null, status: "ACTIVE" }, scopeFilter, explicit] },
    orderBy: [{ class: { name: "asc" } }, { firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      pickupMethod: true,
      class: { select: { id: true, name: true } },
      pickupPersons: {
        where: { status: "APPROVED", deletedAt: null },
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
          relationship: true,
          phone: true,
          photoThumbKey: true,
          expiresAt: true,
        },
      },
    },
  });

  return children.map((child) => ({
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    classId: child.class?.id ?? null,
    className: child.class?.name ?? null,
    method: child.pickupMethod as PickupMethodValue,
    people: child.pickupPersons
      .filter((p) => !isExpired(p.expiresAt, now))
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        relationship: p.relationship,
        phone: p.phone,
        hasPhoto: Boolean(p.photoThumbKey),
        expiresAt: p.expiresAt,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Image authorization (for /api/img/pickup/[id])
// ---------------------------------------------------------------------------

/**
 * The storage key of a pickup person's photo, if this caller may see it.
 *
 * Same shape as the photo route's check: resolve authorization first (can this
 * person view the child?), and return null — a 404 to the caller — for anything
 * they may not see or that does not exist. Never leaks whether an id is real.
 */
export async function getPickupPersonImageKey(
  session: Session,
  pickupPersonId: string,
  variant: "photo" | "thumb",
): Promise<string | null> {
  const person = await prisma.pickupPerson.findFirst({
    where: { id: pickupPersonId, deletedAt: null },
    select: { childId: true, photoStorageKey: true, photoThumbKey: true },
  });
  if (!person) return null;

  try {
    await assertCanViewChild(session, person.childId);
  } catch {
    return null;
  }

  const key =
    (variant === "thumb" && person.photoThumbKey) ||
    person.photoStorageKey ||
    person.photoThumbKey;

  return key ?? null;
}
