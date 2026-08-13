"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Class and day selector.
 *
 * A plain GET form that also navigates on change, so it works without
 * JavaScript and feels immediate with it. The selection lives in the URL rather
 * than in state — a teacher who bookmarks or reloads yesterday's list gets
 * yesterday's list.
 *
 * Deliberately NOT modelled on LiveFilters: that component drives the URL from
 * an effect, which is what made it fire a navigation on every page load until
 * the Strict Mode guard was fixed. Here the navigation is caused by the change
 * event and nothing else.
 */
export function DayPicker({
  classes,
  selectedClassId,
  date,
  t,
}: {
  classes: Array<{ id: string; name: string }>;
  selectedClassId: string;
  date: string;
  t: { chooseClass: string; chooseDate: string; today: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(next: { classId?: string; date?: string }) {
    const params = new URLSearchParams();
    params.set("classId", next.classId ?? selectedClassId);
    params.set("date", next.date ?? date);
    startTransition(() => {
      router.replace(`/admin/reports?${params.toString()}`, { scroll: false });
    });
  }

  const field =
    "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-leaf focus:outline-none";

  return (
    <form
      method="get"
      action="/admin/reports"
      className="mb-6 flex flex-wrap items-end gap-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="min-w-48 flex-1">
        <label htmlFor="classId" className="mb-1.5 block text-sm font-bold">
          {t.chooseClass}
        </label>
        <select
          id="classId"
          name="classId"
          value={selectedClassId}
          onChange={(event) => go({ classId: event.target.value })}
          className={field}
        >
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-44">
        <label htmlFor="date" className="mb-1.5 block text-sm font-bold">
          {t.chooseDate}
        </label>
        <input
          id="date"
          name="date"
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value) go({ date: event.target.value });
          }}
          className={field}
        />
      </div>

      <button
        type="button"
        onClick={() => go({ date: new Date().toISOString().slice(0, 10) })}
        className="rounded-full border-2 border-ink/15 px-5 py-3 font-bold text-ink transition-colors hover:border-leaf hover:text-leaf"
      >
        {t.today}
      </button>

      <span aria-live="polite" className="sr-only">
        {isPending ? "…" : ""}
      </span>
    </form>
  );
}
