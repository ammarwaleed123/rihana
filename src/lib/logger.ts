import "server-only";

import pino from "pino";

import { env, isProduction } from "@/lib/env";

/**
 * Structured logging.
 *
 * Redaction is not a nicety here. This application handles session tokens,
 * password hashes, invite tokens and signed storage URLs; any of those in a log
 * line is a credential sitting in plain text in a log aggregator. The redact
 * list below is the backstop for when someone logs a whole object by reflex.
 */
export const logger = pino({
  level: env.LOG_LEVEL,

  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "token",
      "sessionToken",
      "inviteToken",
      "resetToken",
      "*.token",
      "*.sessionToken",
      "*.inviteToken",
      "*.resetToken",
      "signedUrl",
      "*.signedUrl",
      "req.headers.cookie",
      "req.headers.authorization",
      "headers.cookie",
      "headers.authorization",
      "S3_SECRET_ACCESS_KEY",
      "RESEND_API_KEY",
      "DATABASE_URL",
      "DIRECT_URL",
      "SESSION_SECRET",
    ],
    censor: "[redacted]",
  },

  // Pretty output locally; newline-delimited JSON in production for ingestion.
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});

/**
 * Error reporting hook.
 *
 * Sentry-compatible by shape but not Sentry-dependent: with SENTRY_DSN unset this
 * degrades to a structured log rather than failing or silently swallowing. Wire a
 * real transport here when a DSN exists.
 */
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "UnknownError", message: String(error) };

  logger.error({ err: normalized, ...context }, normalized.message);
}

export type Logger = typeof logger;
