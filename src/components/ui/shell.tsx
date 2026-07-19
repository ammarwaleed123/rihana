import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Layout and display primitives for the admin surface.
 *
 * Tables are the honest choice for admin lists — this is tabular data, and a
 * screen reader announces row/column position for free. They collapse to cards
 * on narrow screens via the `Stack` variant rather than by hiding columns.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink/10 bg-card p-6 shadow-pin",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-xl font-semibold">{children}</h2>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink/15 px-6 py-14 text-center">
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-ink/8 text-ink-soft",
  green: "bg-leaf-soft text-leaf-dark",
  yellow: "bg-sun-soft text-warning",
  coral: "bg-coral-soft text-danger",
  sky: "bg-sky-soft text-ink",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    // Wide tables scroll inside their own container; the page body never
    // scrolls horizontally.
    <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-card shadow-pin">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        {children}
      </table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th
      scope="col"
      className="border-b border-ink/10 px-4 py-3 text-sm font-bold text-ink-soft"
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-b border-ink/8 px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

export function NavTabs({
  items,
  current,
}: {
  items: Array<{ href: string; label: string }>;
  current: string;
}) {
  return (
    <nav aria-label="Admin sections" className="mb-8 border-b border-ink/10">
      <ul className="flex flex-wrap gap-1">
        {items.map((item) => {
          const active =
            current === item.href || current.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-4 py-3 font-bold transition-colors",
                  active
                    ? "border-leaf text-leaf"
                    : "border-transparent text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
