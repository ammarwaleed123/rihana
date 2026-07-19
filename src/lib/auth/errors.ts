import "server-only";

/**
 * Authorization failures.
 *
 * `NotFoundError` is thrown for *both* "does not exist" and "exists but is not
 * yours". That is deliberate: a 403 on someone else's photo confirms the photo
 * exists, which is itself a disclosure. Callers must not try to be more helpful.
 */

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor(message = "Sign in to continue") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "You do not have access to this") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class RateLimitedError extends Error {
  readonly status = 429;
  constructor(
    /** Seconds until the caller may retry. */
    readonly retryAfterSeconds: number,
    message = "Too many attempts. Please try again later.",
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

/**
 * The single message shown for every failed sign-in.
 *
 * Wrong password, unknown address, disabled account and un-accepted invite all
 * produce this exact string. Anything more specific tells an attacker which
 * addresses have accounts at this nursery.
 */
export const GENERIC_LOGIN_ERROR =
  "That email or password is incorrect.";
