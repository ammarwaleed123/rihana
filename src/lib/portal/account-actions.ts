"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  clientIpFromHeaders,
  setSessionCookie,
} from "@/lib/auth/cookies";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/password-constants";
import { requireSessionOrThrow } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { updateMyContactDetails } from "@/lib/data/account";
import { recordAudit } from "@/lib/data/audit";
import { setPassword, verifyPasswordForUser } from "@/lib/data/auth";
import { consumeRateLimit } from "@/lib/data/rate-limit";
import { createSession, type Session } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { personName, phone } from "@/lib/validation";

/**
 * Account self-service.
 *
 * Two of these three actions require the current password to be typed again.
 * Re-authentication is checked server-side inside the action that needs it,
 * never carried as a "recently verified" flag — a flag is something the client
 * asserts, and this is the control standing between a borrowed unlocked phone
 * and taking over a family's account.
 */

export type AccountState = {
  error?: string;
  success?: string;
  errors?: Record<string, string>;
};

async function context(session: Session) {
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);

  return {
    actor: { id: session.user.id, role: session.user.role },
    ipHash: hashIp(ip, env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
    ip: ip ?? "unknown",
  };
}

/**
 * Rate-limit password re-entry.
 *
 * Keyed on the account, not the address: this is an online guessing attack
 * against one known user, and the attacker is already holding their unlocked
 * browser. Ten attempts an hour is generous for a typo and useless for a guess.
 */
async function checkReauthLimit(userId: string): Promise<boolean> {
  const limit = await consumeRateLimit("reauth:user", userId, 10, 3600);
  return limit.allowed;
}

const passwordChange = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Use at least ${PASSWORD_MIN_LENGTH} characters`,
      )
      .max(PASSWORD_MAX_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Those passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "Choose a password you have not used here before",
    path: ["password"],
  });

export async function changePasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await requireSessionOrThrow();

  const parsed = passwordChange.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "_"] ??= issue.message;
    }
    return { errors };
  }

  const ctx = await context(session);

  if (!(await checkReauthLimit(session.user.id))) {
    return { error: "Too many attempts. Please try again later." };
  }

  const confirmed = await verifyPasswordForUser(
    session.user.id,
    parsed.data.currentPassword,
  );

  if (!confirmed) {
    await recordAudit({
      action: "auth.sign_in_failed",
      targetType: "user",
      targetId: session.user.id,
      summary: "Failed password re-entry while changing password",
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return { errors: { currentPassword: "That is not your current password" } };
  }

  /*
   * `setPassword` drops every session for this user, which is the entire point
   * — someone changing their password under duress needs whoever else is
   * signed in to be evicted. But that includes the browser doing the changing,
   * so a fresh session is issued immediately afterwards. The net effect is
   * session rotation on a privilege change: every other device is signed out,
   * this one stays, and the old cookie value is dead either way.
   */
  await setPassword(session.user.id, parsed.data.password);

  const fresh = await createSession(session.user.id, {
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });
  await setSessionCookie(fresh.token, fresh.expiresAt);

  await recordAudit({
    action: "auth.password_changed",
    targetType: "user",
    targetId: session.user.id,
    summary: "Changed their own password",
    ...ctx,
  });

  return {
    success:
      "Password changed. Any other device signed in to this account has been signed out.",
  };
}

/*
 * There is deliberately no changeEmailAction.
 *
 * A parent's email is issued by the nursery — it is the account's identity and
 * its password-reset destination — so it is not the parent's to change. The
 * only self-service credential change here is the password. If an address is
 * wrong, the nursery corrects it; a parent who could change their own email
 * could take over the account from a borrowed unlocked phone.
 */

const contactDetails = z.object({
  name: personName,
  phone,
});

/** Name and phone. No re-authentication: neither can take over an account. */
export async function updateContactDetailsAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await requireSessionOrThrow();

  const parsed = contactDetails.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "_"] ??= issue.message;
    }
    return { errors };
  }

  try {
    await updateMyContactDetails(session, {
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
    });

    return { success: "Your details have been saved." };
  } catch (error) {
    logger.error({ err: error, scope: "updateContact" }, "contact update failed");
    return { error: "Something went wrong. Please try again." };
  }
}
