import "server-only";

import { z } from "zod";

/**
 * Validated server environment.
 *
 * Importing this module from client code is a build error (`server-only`), which
 * is the mechanism that keeps secrets out of the browser bundle. Nothing here is
 * ever prefixed NEXT_PUBLIC_.
 *
 * Parsing happens once at module load: a misconfigured deployment fails at boot
 * with a readable list of problems rather than at 2am inside a request.
 */

/**
 * True while `next build` is compiling. Next sets NODE_ENV=production during a
 * build regardless of where it runs, so deployment-shaped constraints have to be
 * able to tell "compiling" apart from "serving traffic".
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.url(),

    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1),

    SESSION_SECRET: z
      .string()
      .min(32, "SESSION_SECRET must be at least 32 characters"),
    SESSION_TTL_DAYS: positiveInt(30),

    STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanish.default(true),
    SIGNED_URL_TTL_SECONDS: positiveInt(300),
    CDN_BASE_URL: z.string().optional(),

    EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
    EMAIL_FROM: z.string().min(1),
    EMAIL_REPLY_TO: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),

    JOBS_ENABLED: booleanish.default(true),
    JOBS_IN_PROCESS: booleanish.default(true),
    JOB_CONCURRENCY: positiveInt(4),

    MAX_UPLOAD_BYTES: positiveInt(15 * 1024 * 1024),
    MAX_UPLOAD_FILES_PER_BATCH: positiveInt(200),

    /** Per-account attempts. Tight: this is the anti-credential-stuffing control. */
    RATE_LIMIT_LOGIN_MAX: positiveInt(8),
    /**
     * Per-IP attempts. Deliberately much looser than the per-account limit.
     *
     * Whole households share one NAT, and every device inside the nursery shares
     * the office IP. Setting this near the per-account value means one parent
     * mistyping their password locks out everyone behind the same router. The
     * per-account bucket is the precise control; this one exists only to stop a
     * single host spraying many different accounts.
     */
    RATE_LIMIT_LOGIN_IP_MAX: positiveInt(50),
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: positiveInt(900),
    RATE_LIMIT_INQUIRY_MAX: positiveInt(5),
    RATE_LIMIT_INQUIRY_WINDOW_SECONDS: positiveInt(3600),

    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    SENTRY_DSN: z.string().optional(),

    SEED_OWNER_EMAIL: z.email().optional(),
    SEED_OWNER_PASSWORD: z.string().optional(),
  })
  // The S3 driver is useless without credentials, and failing here is far better
  // than discovering it when the first parent opens an album.
  .refine(
    (env) =>
      env.STORAGE_DRIVER !== "s3" ||
      Boolean(
        env.S3_ENDPOINT &&
          env.S3_REGION &&
          env.S3_BUCKET &&
          env.S3_ACCESS_KEY_ID &&
          env.S3_SECRET_ACCESS_KEY,
      ),
    {
      message:
        'STORAGE_DRIVER="s3" requires S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
      path: ["STORAGE_DRIVER"],
    },
  )
  .refine(
    (env) => env.EMAIL_DRIVER !== "resend" || Boolean(env.RESEND_API_KEY),
    {
      message: 'EMAIL_DRIVER="resend" requires RESEND_API_KEY',
      path: ["EMAIL_DRIVER"],
    },
  )
  // A running production server must never use the local storage driver: it would
  // put image bytes on an ephemeral app filesystem and serve them from the app
  // origin, defeating both the private-bucket and the stateless-server rules.
  //
  // Skipped during `next build`, which sets NODE_ENV=production even when run on
  // a developer's machine. The constraint is about serving traffic, not compiling.
  .refine(
    (env) =>
      isBuildPhase ||
      env.NODE_ENV !== "production" ||
      env.STORAGE_DRIVER === "s3",
    {
      message:
        'STORAGE_DRIVER must be "s3" in production — the local driver is a development fallback only',
      path: ["STORAGE_DRIVER"],
    },
  );

function load() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // Deliberately does not echo values — this output reaches logs.
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return parsed.data;
}

export const env = load();

export type Env = typeof env;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
