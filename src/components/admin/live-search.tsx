"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Single-field search that applies as you type.
 *
 * Same reasoning as LiveFilters: the query runs on the server so results stay
 * scoped and complete, with a short debounce and a transition so the list does
 * not flash between keystrokes.
 */
export function LiveSearch({
  basePath,
  label = "Search",
  placeholder,
}: {
  basePath: string;
  label?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const trimmed = query.trim();
      startTransition(() => {
        router.replace(
          trimmed ? `${basePath}?q=${encodeURIComponent(trimmed)}` : basePath,
          { scroll: false },
        );
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query, router, basePath]);

  return (
    <form
      method="get"
      action={basePath}
      role="search"
      className="mb-6"
      onSubmit={(event) => event.preventDefault()}
    >
      <label htmlFor="q" className="mb-1.5 block text-sm font-bold">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id="q"
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="max-w-sm flex-1 rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none"
        />
        <p
          aria-live="polite"
          className={`text-sm font-semibold text-ink-faint transition-opacity ${
            isPending ? "opacity-100" : "opacity-0"
          }`}
        >
          Searching…
        </p>
      </div>
    </form>
  );
}
