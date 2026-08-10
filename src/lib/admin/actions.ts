"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { clientIpFromHeaders } from "@/lib/auth/cookies";
import { ForbiddenError, NotFoundError } from "@/lib/auth/errors";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { recordAudit, type AuditAction } from "@/lib/data/audit";
import {
  archiveChild,
  createChild,
  deleteChild,
  linkGuardian,
  restoreChild,
  unlinkGuardian,
  updateChild,
} from "@/lib/data/children";
import {
  archiveClass,
  assignTeacher,
  createClass,
  unassignTeacher,
  updateClass,
} from "@/lib/data/classes";
import {
  disablePerson,
  enablePerson,
  invitePerson,
  reissueInvite,
} from "@/lib/data/people";
import type { Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { QUEUES, enqueue } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import {
  childInput,
  classInput,
  deleteChildInput,
  fieldErrors,
  guardianshipInput,
  inviteParentInput,
  inviteTeacherInput,
  readAll,
} from "@/lib/validation";

/**
 * Admin server actions.
 *
 * Each one follows the same shape, deliberately:
 *   1. authenticate
 *   2. validate input with Zod at the boundary
 *   3. call the data layer, which enforces authorization
 *   4. write an audit row
 *   5. revalidate affected paths
 *
 * Authorization is never checked here — it lives in the data layer so that it
 * cannot be skipped by a caller that forgets. These functions only translate
 * between form data and that layer.
 */

export type FormState = {
  error?: string;
  errors?: Record<string, string>;
  success?: string;
  /** Set by invite actions so the UI can show a copyable link. */
  inviteUrl?: string;
};

async function context(session: Session) {
  const headerList = await headers();
  return {
    actor: { id: session.user.id, role: session.user.role },
    ipHash: hashIp(clientIpFromHeaders(headerList), env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
  };
}

/**
 * Map thrown errors onto form state.
 *
 * ForbiddenError carries a message written for the person reading it; anything
 * else is deliberately vague, because an unexpected error message is a place
 * where internals leak.
 */
function toFormState(error: unknown, scope: string): FormState {
  if (error instanceof ForbiddenError) return { error: error.message };
  if (error instanceof NotFoundError) return { error: "That item no longer exists." };

  logger.error({ err: error, scope }, "admin action failed");
  return { error: "Something went wrong. Please try again." };
}

async function audit(
  session: Session,
  entry: {
    action: AuditAction;
    targetType: string;
    targetId: string;
    summary: string;
    childId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const ctx = await context(session);
  await recordAudit({ ...entry, ...ctx });
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export async function createClassAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  const parsed = classInput.safeParse({
    name: formData.get("name"),
    ageGroupKey: formData.get("ageGroupKey"),
    academicYear: formData.get("academicYear"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const klass = await createClass(session, parsed.data);

    await audit(session, {
      action: "class.created",
      targetType: "class",
      targetId: klass.id,
      summary: `Created class ${klass.name}`,
      metadata: { ...parsed.data },
    });

    revalidatePath("/admin/classes");
    return { success: `${klass.name} created.` };
  } catch (error) {
    return toFormState(error, "createClass");
  }
}

export async function updateClassAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();
  const classId = String(formData.get("classId") ?? "");

  const parsed = classInput.safeParse({
    name: formData.get("name"),
    ageGroupKey: formData.get("ageGroupKey"),
    academicYear: formData.get("academicYear"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const { updated, before } = await updateClass(session, classId, parsed.data);

    await audit(session, {
      action: "class.updated",
      targetType: "class",
      targetId: updated.id,
      summary: `Updated class ${updated.name}`,
      metadata: { before, after: parsed.data },
    });

    revalidatePath("/admin/classes");
    revalidatePath(`/admin/classes/${classId}`);
    return { success: "Class updated." };
  } catch (error) {
    return toFormState(error, "updateClass");
  }
}

export async function archiveClassAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();
  const classId = String(formData.get("classId") ?? "");

  try {
    const klass = await archiveClass(session, classId);

    await audit(session, {
      action: "class.archived",
      targetType: "class",
      targetId: klass.id,
      summary: `Archived class ${klass.name}`,
    });

    revalidatePath("/admin/classes");
    return { success: `${klass.name} archived.` };
  } catch (error) {
    return toFormState(error, "archiveClass");
  }
}

export async function assignTeacherAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const { user, klass } = await assignTeacher(
      session,
      String(formData.get("userId") ?? ""),
      String(formData.get("classId") ?? ""),
    );

    await audit(session, {
      action: "teacher.assigned",
      targetType: "user",
      targetId: user.id,
      // Worth spelling out: this grants access to every child in that class.
      summary: `Assigned ${user.name} to ${klass.name}`,
      metadata: { classId: klass.id, className: klass.name },
    });

    revalidatePath("/admin/classes");
    revalidatePath("/admin/people");
    return { success: `${user.name} assigned to ${klass.name}.` };
  } catch (error) {
    return toFormState(error, "assignTeacher");
  }
}

export async function unassignTeacherAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const { user, klass } = await unassignTeacher(
      session,
      String(formData.get("userId") ?? ""),
      String(formData.get("classId") ?? ""),
    );

    await audit(session, {
      action: "teacher.unassigned",
      targetType: "user",
      targetId: user.id,
      summary: `Removed ${user.name} from ${klass.name}`,
      metadata: { classId: klass.id, className: klass.name },
    });

    revalidatePath("/admin/classes");
    revalidatePath("/admin/people");
    return { success: `${user.name} removed from ${klass.name}.` };
  } catch (error) {
    return toFormState(error, "unassignTeacher");
  }
}

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

function parseChildForm(formData: FormData) {
  return childInput.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    dateOfBirth: formData.get("dateOfBirth"),
    classId: formData.get("classId"),
    // An unchecked checkbox is absent from FormData entirely.
    photoConsent: formData.get("photoConsent") === "on",
    allergiesNote: formData.get("allergiesNote"),
  });
}

export async function createChildAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();
  const parsed = parseChildForm(formData);

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const child = await createChild(session, parsed.data);

    await audit(session, {
      action: "child.created",
      targetType: "child",
      targetId: child.id,
      childId: child.id,
      summary: `Added ${child.firstName} ${child.lastName}`,
      metadata: { classId: parsed.data.classId, photoConsent: parsed.data.photoConsent },
    });

    revalidatePath("/admin/children");
    return { success: `${child.firstName} added.` };
  } catch (error) {
    return toFormState(error, "createChild");
  }
}

export async function updateChildAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();
  const childId = String(formData.get("childId") ?? "");
  const parsed = parseChildForm(formData);

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const { before, after, photosHidden, photosRestored } = await updateChild(
      session,
      childId,
      parsed.data,
    );

    // Photo consent changing is the interesting one: it alters who may appear in
    // photographs, so it is called out rather than buried in a diff.
    const consentChanged = before.photoConsent !== after.photoConsent;
    const withdrawn = consentChanged && !after.photoConsent;
    const restored = consentChanged && after.photoConsent;

    await audit(session, {
      action: "child.updated",
      targetType: "child",
      targetId: after.id,
      childId: after.id,
      summary: withdrawn
        ? `Withdrew photo consent for ${after.firstName} ${after.lastName}; hid ${photosHidden} photo(s)`
        : restored
          ? `Granted photo consent for ${after.firstName} ${after.lastName}; restored ${photosRestored} photo(s)`
          : `Updated ${after.firstName} ${after.lastName}`,
      metadata: { before, after: parsed.data, photosHidden, photosRestored },
    });

    revalidatePath("/admin/children");
    revalidatePath(`/admin/children/${childId}`);
    revalidatePath("/admin/photos");

    if (withdrawn) {
      return {
        success:
          photosHidden > 0
            ? `Saved. ${after.firstName}'s photo consent is withdrawn, and ${photosHidden} photo${photosHidden === 1 ? "" : "s"} showing only them ${photosHidden === 1 ? "is" : "are"} now hidden from every family.`
            : `Saved. ${after.firstName}'s photo consent is withdrawn; they cannot be tagged in new photos.`,
      };
    }

    if (restored) {
      return {
        success:
          photosRestored > 0
            ? `Saved. ${after.firstName}'s photo consent is restored, and ${photosRestored} photo${photosRestored === 1 ? "" : "s"} ${photosRestored === 1 ? "is" : "are"} visible to their family again.`
            : `Saved. ${after.firstName} can be tagged in photos again.`,
      };
    }

    return { success: "Details saved." };
  } catch (error) {
    return toFormState(error, "updateChild");
  }
}

export async function archiveChildAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const child = await archiveChild(session, String(formData.get("childId") ?? ""));

    await audit(session, {
      action: "child.archived",
      targetType: "child",
      targetId: child.id,
      childId: child.id,
      summary: `Archived ${child.firstName} ${child.lastName}`,
    });

    revalidatePath("/admin/children");
    return { success: `${child.firstName} archived.` };
  } catch (error) {
    return toFormState(error, "archiveChild");
  }
}

export async function restoreChildAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const child = await restoreChild(session, String(formData.get("childId") ?? ""));

    await audit(session, {
      action: "child.updated",
      targetType: "child",
      targetId: child.id,
      childId: child.id,
      summary: `Restored ${child.firstName} ${child.lastName} to active`,
    });

    revalidatePath("/admin/children");
    return { success: `${child.firstName} restored.` };
  } catch (error) {
    return toFormState(error, "restoreChild");
  }
}

/**
 * Permanent deletion. The confirmation is typing the child's full name, checked
 * server-side — a client-side confirm() is not a control.
 */
export async function deleteChildAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  const parsed = deleteChildInput.safeParse({
    childId: formData.get("childId"),
    confirmName: formData.get("confirmName"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Set when the deletion succeeds. The redirect has to happen outside the
  // try/catch below, because Next signals redirects by throwing and the catch
  // would swallow it into a generic "something went wrong".
  let deleted: { firstName: string } | null = null;

  try {
    // Read the name first so the typed confirmation can be compared server-side.
    const { getChildDetail } = await import("@/lib/data/children");
    const child = await getChildDetail(session, parsed.data.childId);

    const expected = `${child.firstName} ${child.lastName}`.toLowerCase();
    if (parsed.data.confirmName.toLowerCase() !== expected) {
      return {
        errors: {
          confirmName: `Type "${child.firstName} ${child.lastName}" exactly to confirm.`,
        },
      };
    }

    const result = await deleteChild(session, parsed.data.childId);

    await audit(session, {
      action: "child.deleted",
      targetType: "child",
      // targetId is a plain string column, so it keeps the id for correlation.
      targetId: result.child.id,
      // childId is a foreign key and MUST stay null here: the row it would
      // point at no longer exists. Setting it violated the constraint, and
      // because recordAudit swallows its own errors the erasure was completing
      // with no audit record at all — the one action that most needs one.
      childId: null,
      summary: `Permanently deleted ${result.child.firstName} ${result.child.lastName} and ${result.orphanedPhotoIds.length} photo(s)`,
      metadata: {
        childId: result.child.id,
        orphanedPhotoCount: result.orphanedPhotoIds.length,
      },
    });

    /*
     * Erase the objects too, not just the rows.
     *
     * Without this the database forgot the child and the audit log said
     * "permanently deleted", while their photographs stayed in the bucket
     * indefinitely — a deletion that did not delete, on the one request where a
     * family is entitled to expect it did.
     *
     * Enqueue failure is non-fatal (the rows are already gone and the request
     * must not fail), but it is logged at error level WITH the keys: a purge
     * that silently never happened is precisely the bug being fixed here, so it
     * has to leave a trail someone can act on.
     */
    if (result.orphanedKeys.length > 0) {
      const jobId = await enqueue(QUEUES.storagePurge, {
        keys: result.orphanedKeys,
      });

      if (!jobId) {
        logger.error(
          {
            scope: "child-deletion",
            childId: result.child.id,
            keys: result.orphanedKeys,
          },
          "storage purge was not queued — objects must be removed by hand",
        );
      }
    }

    revalidatePath("/admin/children");
    deleted = { firstName: result.child.firstName };
  } catch (error) {
    return toFormState(error, "deleteChild");
  }

  // The page this action was submitted from is /admin/children/[childId], whose
  // subject no longer exists — re-rendering it produces a 404 and the success
  // message is never seen. Send the owner back to the roster instead.
  redirect(
    `/admin/children?deleted=${encodeURIComponent(deleted.firstName)}`,
  );
}

// ---------------------------------------------------------------------------
// Guardianships
// ---------------------------------------------------------------------------

export async function linkGuardianAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  const parsed = guardianshipInput.safeParse({
    parentUserId: formData.get("parentUserId"),
    childId: formData.get("childId"),
    relationship: formData.get("relationship"),
    isPrimary: formData.get("isPrimary") === "on",
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const { parent, child } = await linkGuardian(session, parsed.data);

    await audit(session, {
      action: "guardianship.created",
      targetType: "guardianship",
      targetId: `${parent.id}:${child.id}`,
      childId: child.id,
      // This sentence is the one an investigator would read: it grants sight of
      // this child's photographs.
      summary: `Gave ${parent.name} (${parent.email}) access to ${child.firstName} ${child.lastName}`,
      metadata: { relationship: parsed.data.relationship, isPrimary: parsed.data.isPrimary },
    });

    revalidatePath(`/admin/children/${child.id}`);
    revalidatePath("/admin/people");
    return { success: `${parent.name} linked to ${child.firstName}.` };
  } catch (error) {
    return toFormState(error, "linkGuardian");
  }
}

export async function unlinkGuardianAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const { parent, child } = await unlinkGuardian(
      session,
      String(formData.get("parentUserId") ?? ""),
      String(formData.get("childId") ?? ""),
    );

    await audit(session, {
      action: "guardianship.removed",
      targetType: "guardianship",
      targetId: `${parent.id}:${child.id}`,
      childId: child.id,
      summary: `Removed ${parent.name}'s access to ${child.firstName} ${child.lastName}`,
    });

    revalidatePath(`/admin/children/${child.id}`);
    revalidatePath("/admin/people");
    return { success: `${parent.name} no longer has access to ${child.firstName}.` };
  } catch (error) {
    return toFormState(error, "unlinkGuardian");
  }
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export async function inviteParentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  const parsed = inviteParentInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    childIds: readAll(formData, "childIds"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const result = await invitePerson(
      session,
      { ...parsed.data, role: "PARENT" },
      env.APP_URL,
    );

    await audit(session, {
      action: "user.invited",
      targetType: "user",
      targetId: result.user.id,
      summary: `Invited parent ${result.user.name} (${result.user.email})`,
      metadata: { childCount: parsed.data.childIds.length },
      // The token is deliberately absent from metadata — an audit row is not a
      // place to store a live credential.
    });

    revalidatePath("/admin/people");
    return {
      success: `Invitation created for ${result.user.name}.`,
      inviteUrl: result.inviteUrl,
    };
  } catch (error) {
    return toFormState(error, "inviteParent");
  }
}

export async function inviteTeacherAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  const parsed = inviteTeacherInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    classIds: readAll(formData, "classIds"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    const result = await invitePerson(
      session,
      { ...parsed.data, role: "TEACHER" },
      env.APP_URL,
    );

    await audit(session, {
      action: "user.invited",
      targetType: "user",
      targetId: result.user.id,
      summary: `Invited teacher ${result.user.name} (${result.user.email})`,
      metadata: { classCount: parsed.data.classIds.length },
    });

    revalidatePath("/admin/people");
    return {
      success: `Invitation created for ${result.user.name}.`,
      inviteUrl: result.inviteUrl,
    };
  } catch (error) {
    return toFormState(error, "inviteTeacher");
  }
}

export async function reissueInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const result = await reissueInvite(
      session,
      String(formData.get("userId") ?? ""),
      env.APP_URL,
    );

    await audit(session, {
      action: "user.invited",
      targetType: "user",
      targetId: result.user.id,
      summary: `Reissued invitation for ${result.user.name}`,
    });

    revalidatePath("/admin/people");
    return {
      success: `New invitation link for ${result.user.name}.`,
      inviteUrl: result.inviteUrl,
    };
  } catch (error) {
    return toFormState(error, "reissueInvite");
  }
}

export async function disablePersonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const { user, revokedSessions } = await disablePerson(
      session,
      String(formData.get("userId") ?? ""),
    );

    await audit(session, {
      action: "user.disabled",
      targetType: "user",
      targetId: user.id,
      summary: `Disabled ${user.name} (${user.email}) and ended ${revokedSessions} active session(s)`,
      metadata: { revokedSessions },
    });

    revalidatePath("/admin/people");
    return {
      success: `${user.name} disabled${revokedSessions > 0 ? ` and signed out of ${revokedSessions} device(s)` : ""}.`,
    };
  } catch (error) {
    return toFormState(error, "disablePerson");
  }
}

export async function enablePersonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSessionOrThrow();

  try {
    const { user } = await enablePerson(session, String(formData.get("userId") ?? ""));

    await audit(session, {
      action: "user.reenabled",
      targetType: "user",
      targetId: user.id,
      summary: `Re-enabled ${user.name} (${user.email})`,
    });

    revalidatePath("/admin/people");
    return { success: `${user.name} re-enabled.` };
  } catch (error) {
    return toFormState(error, "enablePerson");
  }
}
