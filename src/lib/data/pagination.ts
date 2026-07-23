import "server-only";

/**
 * Cursor (keyset) pagination.
 *
 * Every list in this application paginates this way — no OFFSET anywhere. Two
 * reasons, both of which bite at the scale this system targets:
 *
 *  1. OFFSET makes the database walk and discard every skipped row, so page 200
 *     of an album costs 200 pages of work.
 *  2. OFFSET is unstable under concurrent writes. When a teacher uploads while a
 *     parent is scrolling, rows shift and the parent silently skips or repeats
 *     photos.
 *
 * The cursor is opaque to the client. It encodes the sort key of the last row
 * seen, which for us is always (timestamp, id) — the id breaks ties so that rows
 * sharing a timestamp cannot be skipped.
 */

/** Hard ceiling on any page, regardless of what a caller asks for. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 24;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type Cursor = { at: Date; id: string };

/**
 * Encode a cursor. base64url so it is safe in a query string, and opaque enough
 * that nobody is tempted to construct one by hand.
 */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.at.toISOString()}|${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

/**
 * Decode a cursor, returning null for anything malformed.
 *
 * A bad cursor must degrade to "start from the beginning", never throw: cursors
 * arrive from user-controlled query strings and from stale bookmarks.
 */
export function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null;

  try {
    const [iso, id] = Buffer.from(value, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;

    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return null;

    return { at, id };
  } catch {
    return null;
  }
}

export function clampPageSize(requested?: number): number {
  if (!requested || !Number.isFinite(requested) || requested < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(requested), MAX_PAGE_SIZE);
}

/**
 * Build the page from one over-fetched row.
 *
 * We ask for `limit + 1` rows: if the extra row exists there is another page,
 * which avoids a second COUNT query just to render a "next" button.
 */
export function buildPage<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => Cursor,
): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null,
  };
}

/**
 * Prisma `where` fragments for "strictly older than this cursor", for a list
 * sorted by (createdAt DESC, id DESC).
 *
 * The compound comparison is what makes ties safe: rows sharing a timestamp are
 * ordered by id, so none is skipped or repeated across a page boundary.
 *
 * ---------------------------------------------------------------------------
 * These return an ARRAY, and callers must compose them like this:
 *
 *     where: { AND: [scopeFilter, ...olderThan(cursor)] }
 *
 * never like this:
 *
 *     where: { ...scopeFilter, ...olderThan(cursor) }   // WRONG
 *
 * The cursor condition is an `OR`, and so is the photo routing rule. Spreading
 * both into one object means the second `OR` silently *replaces* the first —
 * the key wins, not the intent. That shipped: for one phase, a parent's album
 * applied the routing rule on page 1 and then, from page 2 onward, returned
 * every published photo in the nursery. It needed twenty-five photos and a tap
 * on "Load more" to show itself, so no test and no manual pass ever saw it.
 *
 * Returning an array is what makes the safe form the natural one — there is
 * nothing to spread into an object, so the mistake cannot be typed. Keep it
 * that way; the literal field names below are also load-bearing, because a
 * computed key would not type-check against Prisma's generated input types and
 * that check is the last thing standing between a typo and a leak.
 */
export function olderThan(cursor: Cursor | null) {
  if (!cursor) return [];

  return [
    {
      OR: [
        { createdAt: { lt: cursor.at } },
        { createdAt: cursor.at, id: { lt: cursor.id } },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Numbered pages (offset)
// ---------------------------------------------------------------------------

/**
 * A numbered page — "page 3 of 12", with prev/next.
 *
 * Used ONLY for the parent-facing photo and album views. Keyset pagination
 * cannot say "page 3 of 12": it has no running count and no way to jump to an
 * arbitrary page, which is exactly the interface a parent asked for. Offset can,
 * and the cost that makes offset a bad idea elsewhere does not apply here: the
 * set being paged is one family's own photos — a few dozen, at most a few
 * hundred — never the whole nursery's tens of thousands. The class-wide feeds
 * and every admin list stay keyset; see the note on `olderThan`.
 */
export type NumberedPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/** Parse a `?page=` query value to a 1-based page, defaulting to 1. */
export function parsePageParam(value: string | undefined | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * Clamp a requested page into range once the total is known, and return the
 * offset to query with. A page past the end lands on the last page rather than
 * showing an empty grid — a stale bookmark or a hand-typed number should not 404.
 */
export function pageOffset(
  requested: number,
  total: number,
  pageSize: number,
): { page: number; pageCount: number; skip: number } {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requested), pageCount);
  return { page, pageCount, skip: (page - 1) * pageSize };
}

/** The same, for lists sorted by (publishedAt DESC, id DESC). */
export function publishedBefore(cursor: Cursor | null) {
  if (!cursor) return [];

  return [
    {
      OR: [
        { publishedAt: { lt: cursor.at } },
        { publishedAt: cursor.at, id: { lt: cursor.id } },
      ],
    },
  ];
}
