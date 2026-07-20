import { describe, expect, it } from "vitest";

import { parentPhotoFilter } from "@/lib/data/photo-filter";

/**
 * The routing rule, tested directly.
 *
 * A parent's album is exactly:
 *   (a) every photo tagged with one of their own children, plus
 *   (b) every CLASS_ALBUM photo belonging to one of their children's classes.
 *
 * These assert the *shape of the filter*, which is what actually reaches the
 * database. The behavioural half — that a second parent really cannot fetch
 * another child's photo over HTTP — is in e2e/photos.spec.ts, because a filter
 * can be correct in isolation and still be bypassed by a route that forgets to
 * apply it.
 */

describe("parentPhotoFilter", () => {
  const childIds = ["child-a", "child-b"];
  const classIds = ["class-1"];

  it("only ever matches READY, published, undeleted photos", () => {
    const filter = parentPhotoFilter(childIds, classIds);

    expect(filter.status).toBe("READY");
    expect(filter.publishedAt).toEqual({ not: null });
    expect(filter.deletedAt).toBeNull();
  });

  it("matches photos tagged with the parent's own children", () => {
    const filter = parentPhotoFilter(childIds, classIds);
    const tagBranch = filter.OR?.find((branch) => "tags" in branch);

    expect(tagBranch).toEqual({
      tags: { some: { childId: { in: childIds } } },
    });
  });

  it("matches class-album photos for their children's classes", () => {
    const filter = parentPhotoFilter(childIds, classIds);
    const classBranch = filter.OR?.find((branch) => "visibility" in branch);

    expect(classBranch).toEqual({
      visibility: "CLASS_ALBUM",
      classId: { in: classIds },
    });
  });

  it("has exactly two ways in, and no third", () => {
    // If a third branch ever appears here, someone has widened who can see
    // photographs of children. That should not pass silently.
    const filter = parentPhotoFilter(childIds, classIds);
    expect(filter.OR).toHaveLength(2);
  });

  it("never matches a TAGGED_ONLY photo through the class branch", () => {
    const filter = parentPhotoFilter(childIds, classIds);
    const classBranch = filter.OR?.find((branch) => "visibility" in branch) as {
      visibility: string;
    };

    // The class branch is the only route that does not require a tag, so it
    // must be pinned to CLASS_ALBUM. Without this, being in a class would grant
    // sight of every photo taken in it.
    expect(classBranch.visibility).toBe("CLASS_ALBUM");
  });

  it("a parent with no children and no classes matches nothing", () => {
    const filter = parentPhotoFilter([], []);

    // Explicitly an impossible id list, not an absent filter. An empty `in`
    // must never be optimised away into "match everything".
    expect(filter.id).toEqual({ in: [] });
    expect(filter.OR).toBeUndefined();
  });

  it("a parent whose child is unassigned still sees that child's tagged photos", () => {
    // Child not yet in a class: the class branch is empty, but the tag branch
    // must still work.
    const filter = parentPhotoFilter(["child-a"], []);
    const tagBranch = filter.OR?.find((branch) => "tags" in branch);

    expect(tagBranch).toEqual({
      tags: { some: { childId: { in: ["child-a"] } } },
    });
  });

  it("does not leak another family's class through an empty child list", () => {
    // Guardianship removed but a stale class id passed in: they must not get a
    // tag branch matching every child.
    const filter = parentPhotoFilter([], ["class-1"]);
    const tagBranch = filter.OR?.find((branch) => "tags" in branch) as {
      tags: { some: { childId: { in: string[] } } };
    };

    expect(tagBranch.tags.some.childId.in).toEqual([]);
  });
});

describe("the filter is a pure function of scope", () => {
  it("produces identical output for identical scope", () => {
    // It must not depend on time, request state or anything ambient — that is
    // what makes it testable at all.
    const a = parentPhotoFilter(["x"], ["y"]);
    const b = parentPhotoFilter(["x"], ["y"]);
    expect(a).toEqual(b);
  });

  it("changes when the scope changes", () => {
    const a = parentPhotoFilter(["x"], ["y"]);
    const b = parentPhotoFilter(["z"], ["y"]);
    expect(a).not.toEqual(b);
  });
});
