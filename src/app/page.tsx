/**
 * Placeholder home page.
 *
 * The real bulletin-board homepage is built in Phase 7. This exists so Phase 0
 * produces something runnable and verifiable, and so the design tokens are
 * exercised end to end.
 */
export default function Home() {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-6 py-24">
      <p className="font-semibold uppercase tracking-widest text-leaf">
        Phase 0 · Foundations
      </p>

      <h1 className="mt-3 text-5xl font-semibold">Rihana Nursery</h1>

      <p className="mt-4 text-lg text-ink-soft">
        The project scaffold is in place: database schema, migrations, design
        tokens, security headers and the health check. The public site is built in
        Phase 7.
      </p>

      <div className="mt-10 rounded-2xl border border-ink/10 bg-card p-6 shadow-pin">
        <h2 className="text-xl font-semibold">What is wired up</h2>
        <ul className="mt-4 space-y-2 text-ink-soft">
          <li>
            <span className="font-semibold text-ink">Database</span> — 17 tables
            on Supabase Postgres, migration checked in
          </li>
          <li>
            <span className="font-semibold text-ink">Authorization</span> — data
            layer boundary enforced by ESLint
          </li>
          <li>
            <span className="font-semibold text-ink">Headers</span> — CSP, HSTS,
            frame denial, no-index on private routes
          </li>
          <li>
            <span className="font-semibold text-ink">Health</span> —{" "}
            <a
              className="font-semibold text-leaf underline underline-offset-4"
              href="/api/health"
            >
              /api/health
            </a>
          </li>
        </ul>
      </div>
    </main>
  );
}
