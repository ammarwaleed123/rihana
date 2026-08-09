"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  clearSessionCookie,
  clientIpFromHeaders,
  readSessionCookie,
  setSessionCookie,
} from "@/lib/auth/cookies";
import { GENERIC_LOGIN_ERROR } from "@/lib/auth/errors";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { getSession, homePathForRole } from "@/lib/auth/scope";
import { hashIp } from "@/lib/auth/tokens";
import { adoptUserLocale, getUserLocale } from "@/lib/data/account";
import { recordAudit } from "@/lib/data/audit";
import {
  peekLocaleCookie,
  setLocaleCookie,
  toLocale,
} from "@/lib/i18n/locale-cookie";
import {
  findUserByInviteToken,
  findUserByResetToken,
  issueResetToken,
  setPassword,
  verifyCredentials,
} from "@/lib/data/auth";
import { consumeRateLimit, resetRateLimit } from "@/lib/data/rate-limit";
import {
  createSession,
  invalidateSession,
} from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Authentication server actions.
 *
 * CSRF: Next verifies the Origin header against the Host for every server action
 * invocation, and our session cookie is SameSite=Lax. `form-action 'self'` in the
 * CSP is the third layer. No hand-rolled token is needed or wanted.
 */

export type ActionState = { error?: string; success?: string };

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  next: z.string().optional(),
});

/**
 * Only same-origin relative paths are honoured as a post-login destination.
 * Without this check, `?next=https://evil.example` turns our sign-in page into
 * an open redirect that phishing can borrow our domain's credibility from.
 */
function safeRedirectPath(next: string | undefined, fallback: string): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.startsWith("/signin")) return fallback;
  return next;
}

/**
 * Sign out whoever currently holds this browser, if anyone.
 *
 * Used by the invite and reset flows, where the person completing the form is
 * not necessarily the person already signed in.
 */
async function endCurrentSession(): Promise<void> {
  const token = await readSessionCookie();
  if (token) await invalidateSession(token);
  await clearSessionCookie();
}

async function requestContext() {
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);

  return {
    ipHash: hashIp(ip, env.SESSION_SECRET),
    userAgent: headerList.get("user-agent"),
    // Raw IP is used only as a rate-limit bucket, never persisted.
    ip: ip ?? "unknown",
  };
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };

  const { email, password, next } = parsed.data;
  const ctx = await requestContext();

  // Two buckets with deliberately different limits.
  //
  // The per-account bucket is tight — that is the control that actually stops
  // someone guessing one family's password. The per-IP bucket is much looser
  // because it is blunt: an entire household, or every device inside the
  // nursery, shares one address. Sizing them equally would mean one parent
  // fumbling their password locks out everyone behind the same router.
  const byIp = await consumeRateLimit(
    "signin:ip",
    ctx.ip,
    env.RATE_LIMIT_LOGIN_IP_MAX,
    env.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
  );
  const byEmail = await consumeRateLimit(
    "signin:email",
    email,
    env.RATE_LIMIT_LOGIN_MAX,
    env.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
  );

  if (!byIp.allowed || !byEmail.allowed) {
    const retryAfter = Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds);
    logger.warn({ scope: "signin", ipHash: ctx.ipHash }, "rate limited");
    return {
      error: `Too many sign-in attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
    };
  }

  const outcome = await verifyCredentials(email, password);

  if (!outcome.ok) {
    // The reason is logged, never shown. See GENERIC_LOGIN_ERROR.
    logger.warn(
      { scope: "signin", reason: outcome.reason, ipHash: ctx.ipHash },
      "sign-in failed",
    );

    await recordAudit({
      action: "auth.sign_in_failed",
      targetType: "user",
      targetId: email,
      summary: `Failed sign-in (${outcome.reason})`,
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return { error: GENERIC_LOGIN_ERROR };
  }

  // Clear the counters so a person who mistyped twice is not penalised further.
  await Promise.all([
    resetRateLimit("signin:ip", ctx.ip),
    resetRateLimit("signin:email", email),
  ]);

  const { token } = await createSession(outcome.userId, {
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });
  await setSessionCookie(token);

  /*
   * Settle the language for the session that is starting.
   *
   * Two sources disagree here, and the more RECENT intention wins. The account
   * carries what this person chose last time; the cookie carries what they
   * chose moments ago — by reading the Arabic public site, or by using the
   * toggle on the sign-in page itself. Signing in used to overwrite the second
   * with the first, which threw away the choice they had just made and dropped
   * them into English.
   *
   * So a cookie that disagrees is adopted onto the account, and follows them to
   * their next device.
   *
   * NO cookie is not a choice, and must not be read as one. On a new phone
   * there is nothing to state a preference with, and treating that silence as
   * "English" overwrote the Arabic the account had been holding all along —
   * destroying the very setting the column exists to carry between devices.
   * So absence falls back to the account, which is the durable answer.
   *
   * Display only either way — this cookie grants nothing (see
   * i18n/locale-cookie.ts).
   */
  const saved = toLocale(await getUserLocale(outcome.userId));
  const chosen = await peekLocaleCookie();

  if (chosen && chosen !== saved) {
    await adoptUserLocale(outcome.userId, chosen);
  }
  await setLocaleCookie(chosen ?? saved);

  await recordAudit({
    action: "auth.signed_in",
    targetType: "user",
    targetId: outcome.userId,
    summary: "Signed in",
    actor: { id: outcome.userId, role: outcome.role },
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });

  redirect(safeRedirectPath(next, homePathForRole(outcome.role)));
}

export async function signOutAction(): Promise<void> {
  const session = await getSession();
  const token = await readSessionCookie();

  if (token) await invalidateSession(token);
  await clearSessionCookie();

  if (session) {
    const ctx = await requestContext();
    await recordAudit({
      action: "auth.signed_out",
      targetType: "user",
      targetId: session.user.id,
      summary: "Signed out",
      actor: { id: session.user.id, role: session.user.role },
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
    });
  }

  redirect("/signin");
}

// ---------------------------------------------------------------------------
// Invite acceptance
// ---------------------------------------------------------------------------

const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
  .max(PASSWORD_MAX_LENGTH);

const acceptInviteSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Those passwords do not match",
    path: ["confirmPassword"],
  });

export async function acceptInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const ctx = await requestContext();

  const limit = await consumeRateLimit("invite:ip", ctx.ip, 10, 3600);
  if (!limit.allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  const user = await findUserByInviteToken(parsed.data.token);
  if (!user) {
    return {
      error: "This invitation link is invalid or has expired. Ask the nursery to send a new one.",
    };
  }

  await setPassword(user.id, parsed.data.password);

  await recordAudit({
    action: "auth.invite_accepted",
    targetType: "user",
    targetId: user.id,
    summary: `${user.name} activated their account`,
    actor: { id: user.id, role: user.role },
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });

  // End whoever was already signed in on this browser.
  //
  // The person accepting an invitation is by definition someone else — commonly
  // the owner, who created the invitation moments earlier in the same browser.
  // Leaving that session intact meant the sign-in redirect below saw a valid
  // owner session and bounced the new parent straight into the admin panel.
  await endCurrentSession();

  // Deliberately not auto-signed-in: exercising the new password once proves the
  // person knows it, rather than merely holding the emailed link.
  redirect("/signin?activated=1");
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Always reports success.
 *
 * Whether or not the address has an account, the response is identical.
 * Distinguishing them would reveal which families attend this nursery.
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
    .safeParse({ email: formData.get("email") });

  const confirmation = {
    success:
      "If that email address has an account, a reset link is on its way. The link expires in one hour.",
  };

  if (!parsed.success) return confirmation;

  const ctx = await requestContext();

  const limit = await consumeRateLimit("reset:ip", ctx.ip, 5, 3600);
  if (!limit.allowed) return confirmation;

  const issued = await issueResetToken(parsed.data.email);

  if (issued) {
    await recordAudit({
      action: "auth.password_reset_requested",
      targetType: "user",
      targetId: issued.userId,
      summary: "Password reset requested",
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    // Wired to the email adapter in Phase 5. Until then the link is logged so
    // the flow is testable end to end in development.
    logger.info(
      { scope: "password-reset", userId: issued.userId },
      `Password reset link: ${env.APP_URL}/reset-password?token=${issued.token}`,
    );
  }

  return confirmation;
}

const completeResetSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Those passwords do not match",
    path: ["confirmPassword"],
  });

export async function completePasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = completeResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const ctx = await requestContext();

  const limit = await consumeRateLimit("reset-complete:ip", ctx.ip, 10, 3600);
  if (!limit.allowed) {
    return { error: "Too many attempts. Please try again later." };
  }

  const user = await findUserByResetToken(parsed.data.token);
  if (!user) {
    return {
      error: "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  // setPassword also drops every existing session for this user — the point of
  // a reset is to evict whoever else was signed in.
  await setPassword(user.id, parsed.data.password);

  await recordAudit({
    action: "auth.password_reset_completed",
    targetType: "user",
    targetId: user.id,
    summary: "Password reset completed",
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });

  // Same reasoning as invite acceptance: a different person may hold this
  // browser, and their session would otherwise swallow the redirect.
  await endCurrentSession();

  redirect("/signin?reset=1");
}
