import { describe, expect, it } from "vitest";

import { childPhotoFilter, parentPhotoFilter } from "@/lib/data/photo-filter";

/**
 * Narrowing a parent's album to one child.
 *
 * Reported by the owner: tapping a child's name hid the class-album photos that
 * child appears in. Filtering to tags alone is wrong — a photo of the whole
 * class is a photo of that child too, and hiding it is exactly the opposite of
 * what tapping their name is asking for.
 */

describe("childPhotoFilter", () => {
  it("includes photos tagged with that child", () => {
    const filter = childPhotoFilter("child-a", "class-1");
    const tagBranch = filter.OR?.find((branch) => "tags" in branch);

    expect(tagBranch).toEqual({
      tags: { some: { childId: { in: ["child-a"] } } },
    });
  });

  it("also includes class albums for that child's class", () => {
    // The bug: this branch was missing entirely.
    const filter = childPhotoFilter("child-a", "class-1");
    const classBranch = filter.OR?.find((branch) => "visibility" in branch);

    expect(classBranch).toEqual({
      visibility: "CLASS_ALBUM",
      classId: { in: ["class-1"] },
    });
  });

  it("still only ever matches published, ready photos", () => {
    const filter = childPhotoFilter("child-a", "class-1");

    expect(filter.status).toBe("READY");
    expect(filter.publishedAt).toEqual({ not: null });
    expect(filter.deletedAt).toBeNull();
  });

  it("narrows to one child, never widening to the parent's others", () => {
    const narrowed = childPhotoFilter("child-a", "class-1");
    const wide = parentPhotoFilter(["child-a", "child-b"], ["class-1", "class-2"]);

    const narrowTags = narrowed.OR?.find((b) => "tags" in b) as {
      tags: { some: { childId: { in: string[] } } };
    };
    const wideTags = wide.OR?.find((b) => "tags" in b) as {
      tags: { some: { childId: { in: string[] } } };
    };

    expect(narrowTags.tags.some.childId.in).toEqual(["child-a"]);
    expect(wideTags.tags.some.childId.in).toHaveLength(2);
  });

  it("a child with no class matches no class albums", () => {
    // An unassigned child must not pick up every class album ever published.
    const filter = childPhotoFilter("child-a", null);
    const classBranch = filter.OR?.find((branch) => "visibility" in branch) as {
      classId: { in: string[] };
    };

    expect(classBranch.classId.in).toEqual([]);
  });

  it("has exactly two ways in, like the unnarrowed rule", () => {
    expect(childPhotoFilter("child-a", "class-1").OR).toHaveLength(2);
  });

  it("pins the class branch to CLASS_ALBUM", () => {
    // Without this, narrowing to a child would expose every photo taken in
    // their class, tagged or not.
    const filter = childPhotoFilter("child-a", "class-1");
    const classBranch = filter.OR?.find((b) => "visibility" in b) as {
      visibility: string;
    };

    expect(classBranch.visibility).toBe("CLASS_ALBUM");
  });
});
