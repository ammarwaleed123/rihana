import "server-only";

import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import {
  buildPage,
  clampPageSize,
  decodeCursor,
  olderThan,
  type Page,
} from "@/lib/data/pagination";
import type { Session } from "@/lib/data/sessions";
import { prisma } from "@/lib/db";
import type { InquiryInput } from "@/lib/validation";

/**
 * Admissions inquiries.
 *
 * The one write here that is NOT authenticated: `createInquiry` is called from a
 * public form, so it takes only validated input and a hashed IP — never a
 * session. Everything else is owner-only, because a lead list is contact details
 * for other people's families.
 */

export type InquiryStatusValue =
  | "NEW"
  | "CONTACTED"
  | "TOURED"
  | "ENROLLED"
  | "CLOSED";

/** Create an inquiry from the public form. Anonymous by design. */
export async function createInquiry(
  input: InquiryInput,
  meta: { ipHash: string | null },
): Promise<{ id: string }> {
  return prisma.inquiry.create({
    data: {
      kind: input.kind,
      parentName: input.parentName,
      email: input.email,
      phone: input.phone ?? null,
      childFirstName: input.childFirstName ?? null,
      childDateOfBirth: input.childDateOfBirth ?? null,
      preferredStartDate: input.preferredStartDate ?? null,
      preferredVisit: input.preferredVisit ?? null,
      message: input.message ?? null,
      ipHash: meta.ipHash,
      status: "NEW",
    },
    select: { id: true },
  });
}

export type InquiryKindValue = "VISIT" | "QUESTION";

export type InquiryListItem = {
  id: string;
  parentName: string;
  email: string;
  phone: string | null;
  childFirstName: string | null;
  kind: InquiryKindValue;
  status: InquiryStatusValue;
  createdAt: Date;
  handledByName: string | null;
};

export async function listInquiries(
  session: Session,
  options: { cursor?: string | null; status?: string | null } = {},
): Promise<Page<InquiryListItem>> {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const limit = clampPageSize(25);
  const cursor = decodeCursor(options.cursor);
  const status =
    options.status &&
    ["NEW", "CONTACTED", "TOURED", "ENROLLED", "CLOSED"].includes(options.status)
      ? (options.status as InquiryStatusValue)
      : null;

  const rows = await prisma.inquiry.findMany({
    where: { AND: [status ? { status } : {}, ...olderThan(cursor)] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      parentName: true,
      email: true,
      phone: true,
      childFirstName: true,
      kind: true,
      status: true,
      createdAt: true,
      handledBy: { select: { name: true } },
    },
  });

  return buildPage(
    rows.map((r) => ({
      id: r.id,
      parentName: r.parentName,
      email: r.email,
      phone: r.phone,
      childFirstName: r.childFirstName,
      kind: r.kind as InquiryKindValue,
      status: r.status as InquiryStatusValue,
      createdAt: r.createdAt,
      handledByName: r.handledBy?.name ?? null,
    })),
    limit,
    (r) => ({ at: r.createdAt, id: r.id }),
  );
}

export async function getInquiryDetail(session: Session, id: string) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      parentName: true,
      email: true,
      phone: true,
      childFirstName: true,
      childDateOfBirth: true,
      preferredStartDate: true,
      preferredVisit: true,
      message: true,
      status: true,
      internalNotes: true,
      createdAt: true,
      handledBy: { select: { id: true, name: true } },
    },
  });
  if (!inquiry) throw new NotFoundError();
  return inquiry;
}

/** New (unworked) inquiries — for the dashboard and nav badge. Owners only. */
export async function countNewInquiries(session: Session): Promise<number> {
  if (session.user.role !== "OWNER") return 0;
  return prisma.inquiry.count({ where: { status: "NEW" } });
}

/**
 * Move an inquiry along the pipeline and/or save a note.
 *
 * The first time an owner touches an inquiry, it's stamped with their name as the
 * handler, so a team can see who is following up which family.
 */
export async function updateInquiry(
  session: Session,
  id: string,
  changes: { status?: InquiryStatusValue; internalNotes?: string | null },
) {
  if (session.user.role !== "OWNER") throw new ForbiddenError();

  const existing = await prisma.inquiry.findUnique({
    where: { id },
    select: { id: true, status: true, handledByUserId: true },
  });
  if (!existing) throw new NotFoundError();

  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.internalNotes !== undefined
        ? { internalNotes: changes.internalNotes }
        : {}),
      // Claim it for whoever first works it.
      ...(existing.handledByUserId ? {} : { handledByUserId: session.user.id }),
    },
    select: { id: true, status: true, parentName: true },
  });

  return { before: existing.status as InquiryStatusValue, ...updated };
}
