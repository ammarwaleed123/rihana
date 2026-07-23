import { describe, expect, it } from "vitest";

import {
  buildPage,
  clampPageSize,
  decodeCursor,
  encodeCursor,
  MAX_PAGE_SIZE,
  olderThan,
  publishedBefore,
} from "@/lib/data/pagination";
import { parentPhotoFilter } from "@/lib/data/photo-filter";

/**
 * Cursor pagination, and specifically how a cursor COMPOSES with a scope filter.
 *
 * The composition is the part that broke. `parentPhotoFilter` was correct, and
 * every test of it passed, but the query that used it merged the cursor in with
 * an object spread — and since both are expressed as `OR`, the cursor replaced
 * the routing rule outright. Page 1 of a parent's album was correct; page 2
 * returned every published photo in the nursery.
 *
 * So the tests below assert something the filter's own unit tests structurally
 * cannot: that after a cursor is applied, the routing rule is *still there*.
 */

describe("cursor round-trip", () => {
  it("survives an encode/decode round trip", () => {
    const at = new Date("2026-07-19T10:30:00.000Z");
    const decoded = decodeCursor(encodeCursor({ at, id: "photo-1" }));

    expect(decoded?.at.toISOString()).toBe(at.toISOString());
    expect(decoded?.id).toBe("photo-1");
  });

  it("treats a malformed cursor as no cursor rather than throwing", () => {
    // These arrive from query strings and stale bookmarks. Throwing would turn
    // a mangled link into a 500; degrading to page 1 is the only safe answer.
    expect(decodeCursor("not-base64-at-all!!")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(Buffer.from("no-pipe").toString("base64url"))).toBeNull();
    expect(
      decodeCursor(Buffer.from("not-a-date|abc").toString("base64url")),
    ).toBeNull();
  });

  it("caps the page size however large a caller asks for", () => {
    expect(clampPageSize(10_000)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(-1)).toBeGreaterThan(0);
    expect(clampPageSize(undefined)).toBeGreaterThan(0);
  });
});

describe("olderThan", () => {
  const cursor = { at: new Date("2026-07-19T10:30:00.000Z"), id: "photo-9" };

  it("returns an array, so it can only be composed with AND", () => {
    // Not cosmetic. An object could be spread into the same literal as a scope
    // filter and silently clobber it; an array cannot.
    expect(Array.isArray(olderThan(cursor))).toBe(true);
    expect(Array.isArray(olderThan(null))).toBe(true);
  });

  it("contributes nothing when there is no cursor", () => {
    expect(olderThan(null)).toEqual([]);
    expect(publishedBefore(null)).toEqual([]);
  });

  it("breaks ties on id so no row is skipped or repeated", () => {
    const [fragment] = olderThan(cursor);

    expect(fragment.OR).toEqual([
      { createdAt: { lt: cursor.at } },
      { createdAt: cursor.at, id: { lt: cursor.id } },
    ]);
  });

  it("sorts albums on publishedAt rather than createdAt", () => {
    const [fragment] = publishedBefore(cursor);

    expect(fragment.OR).toEqual([
      { publishedAt: { lt: cursor.at } },
      { publishedAt: cursor.at, id: { lt: cursor.id } },
    ]);
  });
});

describe("composing a cursor with the routing rule", () => {
  const filter = parentPhotoFilter(["child-a"], ["class-1"]);
  const cursor = { at: new Date("2026-07-19T10:30:00.000Z"), id: "photo-9" };

  /**
   * THE REGRESSION.
   *
   * This is what the shipped query did. It is here, spelled out, because the
   * failure is invisible at a glance — the object looks like it has everything
   * in it, and the type checker is perfectly happy.
   */
  it("spreading loses the routing rule — which is why we do not spread", () => {
    const wrong = { ...filter, ...olderThanAsObject(cursor) };

    // Both branches of the routing rule are gone. What is left matches every
    // published photo in the nursery.
    expect(wrong.OR).toHaveLength(2);
    expect(JSON.stringify(wrong.OR)).not.toContain("child-a");
    expect(JSON.stringify(wrong.OR)).not.toContain("class-1");
  });

  it("ANDing keeps the routing rule intact alongside the cursor", () => {
    const where = { AND: [filter, ...olderThan(cursor)] };

    expect(where.AND).toHaveLength(2);

    const [scope, page] = where.AND;
    expect(JSON.stringify(scope)).toContain("child-a");
    expect(JSON.stringify(scope)).toContain("class-1");
    expect(JSON.stringify(page)).toContain("createdAt");
  });

  it("keeps the rule on page one too, where there is no cursor at all", () => {
    const where = { AND: [filter, ...olderThan(null)] };

    expect(where.AND).toHaveLength(1);
    expect(JSON.stringify(where.AND[0])).toContain("child-a");
  });
});

/** The old, unsafe shape — reproduced only so the test above can assert on it. */
function olderThanAsObject(cursor: { at: Date; id: string }) {
  return {
    OR: [
      { createdAt: { lt: cursor.at } },
      { createdAt: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

describe("buildPage", () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({
    id: `row-${i}`,
    createdAt: new Date(2026, 6, 19, 12, i),
  }));

  const toCursor = (row: (typeof rows)[number]) => ({
    at: row.createdAt,
    id: row.id,
  });

  it("reports another page when the over-fetched row comes back", () => {
    const page = buildPage(rows, 3, toCursor);

    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it("reports no more when the page is not full", () => {
    const page = buildPage(rows.slice(0, 2), 3, toCursor);

    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("points the cursor at the last returned row, not the over-fetched one", () => {
    const page = buildPage(rows, 3, toCursor);

    expect(decodeCursor(page.nextCursor)?.id).toBe("row-2");
  });

  it("handles an empty result without inventing a cursor", () => {
    const page = buildPage([], 3, toCursor);

    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});
