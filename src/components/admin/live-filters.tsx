"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

/**
 * Filters that apply as you type.
 *
 * Filtering stays on the server — it has to, because which children you may see
 * is decided by the data layer, and a client-side filter over a page of results
 * would silently stop working the moment the roster outgrows one page.
 *
 * So each keystroke updates the URL and lets the server re-render. Two details
 * make that pleasant rather than janky:
 *
 *   - A short debounce, so a five-letter name is one request rather than five.
 *   - `useTransition`, so the current results stay on screen while the next set
 *     loads instead of blanking out.
 *
 * The form still works with JavaScript disabled: it is a real GET form with a
 * submit button, and this only enhances it.
 */
/**
 * The canonical query string for a set of filter values.
 *
 * Used for both sides of the "has anything actually changed?" comparison, so
 * that key order and blank-vs-absent can never make two identical filters look
 * different.
 */
function filterQuery(query: string, classId: string, archived: boolean): string {
  const next = new URLSearchParams();
  if (query.trim()) next.set("q", query.trim());
  if (classId) next.set("classId", classId);
  if (archived) next.set("archived", "1");
  return next.toString();
}

export function LiveFilters({
  classes,
  t,
  basePath = "/admin/children",
}: {
  classes: Array<{ id: string; name: string }>;
  t: Dictionary["admin"]["children"];
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [classId, setClassId] = useState(params.get("classId") ?? "");
  const [archived, setArchived] = useState(params.get("archived") === "1");

  useEffect(() => {
    const timer = setTimeout(() => {
      const qs = filterQuery(query, classId, archived);

      /*
       * Do nothing when the URL already says this.
       *
       * This replaces a "skip the first render" ref, which looked equivalent and
       * was not: a ref survives the remount React simulates in Strict Mode, so
       * the second pass sailed past the guard and fired `router.replace` on
       * every single page load. That left a transition pending — the filter
       * stuck on "Filtering…" — and swallowed the next click, which is how
       * clicking a child's "Manage" link stopped navigating at all.
       *
       * Comparing state to the URL is idempotent, so running twice costs
       * nothing. Both sides go through the same builder, because comparing
       * against the raw query string would differ on key order alone.
       */
      if (qs === filterQuery(
        params.get("q") ?? "",
        params.get("classId") ?? "",
        params.get("archived") === "1",
      )) {
        return;
      }

      startTransition(() => {
        // `replace`, not `push`: typing a name should not bury the previous page
        // under one history entry per keystroke.
        router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query, classId, archived, router, basePath, params]);

  const field =
    "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none";

  return (
    <form
      method="get"
      action={basePath}
      role="search"
      className="mb-6 flex flex-wrap items-end gap-3"
      // The live effect already applied everything; stop a stray Enter from
      // doing a full page navigation on top of it.
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="min-w-48 flex-1">
        <label htmlFor="q" className="mb-1.5 block text-sm font-bold">
          {t.searchByName}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          autoComplete="off"
          className={field}
        />
      </div>

      <div className="min-w-44">
        <label htmlFor="classId" className="mb-1.5 block text-sm font-bold">
          {t.colClass}
        </label>
        <select
          id="classId"
          name="classId"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className={field}
        >
          <option value="">{t.allClasses}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 pb-3 text-sm font-semibold">
        <input
          type="checkbox"
          name="archived"
          value="1"
          checked={archived}
          onChange={(event) => setArchived(event.target.checked)}
          className="size-4 accent-[color:var(--color-leaf)]"
        />
        {t.includeLeft}
      </label>

      {/*
        Announced politely so a screen-reader user hears that results changed;
        `aria-live` on an always-present node rather than one that appears, which
        would not be announced reliably.
      */}
      <p
        aria-live="polite"
        className={`pb-3 text-sm font-semibold text-ink-faint transition-opacity ${
          isPending ? "opacity-100" : "opacity-0"
        }`}
      >
        {t.filtering}
      </p>

      <noscript>
        <button type="submit" className={`${field} font-bold`}>
          {t.filter}
        </button>
      </noscript>
    </form>
  );
}
