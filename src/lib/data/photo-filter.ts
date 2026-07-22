/**
 * THE ROUTING RULE.
 *
 * A parent's album is exactly:
 *
 *   (a) every photo tagged with one of their own children, plus
 *   (b) every CLASS_ALBUM photo belonging to one of their children's classes.
 *
 * Nothing else. Ever.
 *
 * This file deliberately has **no imports** — not the database client, not the
 * environment, nothing. The single most consequential rule in this application
 * should be testable in complete isolation, without a connection string or a
 * running server, so there is never an excuse not to test a change to it.
 *
 * See tests/photo-routing.test.ts.
 */

/** Only READY, published, undeleted photos are visible to anyone. */
const VISIBLE = {
  status: "READY" as const,
  publishedAt: { not: null },
  deletedAt: null,
};

export type ParentPhotoFilter = typeof VISIBLE & {
  id?: { in: string[] };
  OR?: Array<
    | { tags: { some: { childId: { in: string[] } } } }
    | { visibility: "CLASS_ALBUM"; classId: { in: string[] } }
  >;
};

/**
 * Build the filter from an already-resolved scope.
 *
 * Takes ids rather than a session so it stays a pure function: same input, same
 * output, no ambient state.
 */
/**
 * The same rule, narrowed to one child.
 *
 * "Show me Laila's photos" must mean photos tagged with Laila **plus** class
 * albums for Laila's class — she is in that class, so those photos are hers as
 * much as the tagged ones. Filtering to tags alone made class-album photos
 * vanish the moment a parent picked a child, which is exactly when they were
 * looking for them.
 *
 * Callers must pass a child the parent actually guards, and that child's own
 * class id — never one supplied by the request.
 */
export function childPhotoFilter(
  childId: string,
  childClassId: string | null,
): ParentPhotoFilter {
  return {
    ...VISIBLE,
    OR: [
      { tags: { some: { childId: { in: [childId] } } } },
      {
        visibility: "CLASS_ALBUM",
        classId: { in: childClassId ? [childClassId] : [] },
      },
    ],
  };
}

export function parentPhotoFilter(
  childIds: string[],
  classIds: string[],
): ParentPhotoFilter {
  // A parent with no children sees nothing. Stated explicitly rather than left
  // to fall out of an empty `in`, because "empty list matches nothing" is
  // exactly the assumption that breaks when someone rewrites this as raw SQL.
  if (childIds.length === 0 && classIds.length === 0) {
    return { ...VISIBLE, id: { in: [] } };
  }

  return {
    ...VISIBLE,
    OR: [
      // (a) tagged with one of their own children
      { tags: { some: { childId: { in: childIds } } } },
      // (b) a class-album photo for one of their children's classes.
      //
      // `visibility` is pinned here on purpose: this is the only branch that
      // does not require a tag, so without it, being enrolled in a class would
      // grant sight of every photo ever taken in that class.
      { visibility: "CLASS_ALBUM", classId: { in: classIds } },
    ],
  };
}
