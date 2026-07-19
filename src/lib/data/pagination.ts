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
 * Prisma `where` fragment for "strictly older than this cursor", for a list
 * sorted by (createdAt DESC, id DESC).
 *
 * The compound comparison is what makes ties safe: rows sharing a timestamp are
 * ordered by id, so none is skipped or repeated across a page boundary.
 */
export function olderThan(cursor: Cursor | null, field = "createdAt") {
  if (!cursor) return {};

  return {
    OR: [
      { [field]: { lt: cursor.at } },
      { [field]: cursor.at, id: { lt: cursor.id } },
    ],
  };
}
