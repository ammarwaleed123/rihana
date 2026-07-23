import Link from "next/link";

/**
 * Numbered pager — "‹ Prev  1 2 … 5 6 …  Next ›".
 *
 * A server component: pages are plain links carrying `?page=N`, so navigation
 * works without JavaScript and each page has a real, shareable URL. `hrefFor`
 * builds that URL, so the caller keeps whatever other query it needs (the
 * per-child filter) alongside the page number.
 *
 * The number strip is windowed: first and last are always shown, with a few
 * around the current page and an ellipsis for the gaps, so a family with forty
 * pages does not get forty links.
 */
export function Pager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const numbers = pageWindow(page, pageCount);

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      <Step
        href={hrefFor(page - 1)}
        disabled={page <= 1}
        label="Previous page"
      >
        ‹ Prev
      </Step>

      <ul className="flex items-center gap-1">
        {numbers.map((n, index) =>
          n === ELLIPSIS ? (
            <li
              key={`gap-${index}`}
              aria-hidden
              className="px-2 text-ink-faint"
            >
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={hrefFor(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={
                  n === page
                    ? "flex size-10 items-center justify-center rounded-full bg-leaf font-bold text-white"
                    : "flex size-10 items-center justify-center rounded-full border-2 border-ink/15 bg-card font-bold hover:border-leaf hover:text-leaf"
                }
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ul>

      <Step href={hrefFor(page + 1)} disabled={page >= pageCount} label="Next page">
        Next ›
      </Step>
    </nav>
  );
}

function Step({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex items-center rounded-full border-2 px-4 py-2 font-bold";

  if (disabled) {
    return (
      <span
        aria-disabled
        className={`${className} cursor-not-allowed border-ink/10 text-ink-faint`}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${className} border-ink/15 bg-card hover:border-leaf hover:text-leaf`}
    >
      {children}
    </Link>
  );
}

const ELLIPSIS = -1;

/**
 * The page numbers to show: always the first and last, the current page and one
 * either side, with -1 marking a gap. Kept small and deterministic so the strip
 * does not jump around in width as you page through.
 */
function pageWindow(page: number, pageCount: number): number[] {
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);

  const sorted = [...pages]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);

  const out: number[] = [];
  let previous = 0;
  for (const n of sorted) {
    if (n - previous > 1) out.push(ELLIPSIS);
    out.push(n);
    previous = n;
  }
  return out;
}
