/**
 * No-op stand-in for the `server-only` package, used by the worker process.
 *
 * See tsconfig.worker.json for why. The real package throws outside Next's
 * "react-server" export condition; the worker is a plain Node process with no
 * client bundle, so the guard has nothing to protect and only gets in the way.
 */
export {};
