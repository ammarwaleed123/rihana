/**
 * No-op stand-in for the `server-only` package under Vitest.
 *
 * The real package throws unless it is resolved through React's "react-server"
 * export condition, which only Next's bundler sets. Its guarantee — that a
 * module never reaches the client bundle — is enforced at build time by Next,
 * so stubbing it in tests removes a false failure without weakening anything
 * that ships.
 */
export {};
