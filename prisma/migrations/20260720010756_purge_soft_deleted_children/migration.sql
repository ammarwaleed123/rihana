-- Finish erasures that were previously only soft-deleted.
--
-- An earlier version of deleteChild() set `deletedAt` and left the row in place,
-- while the interface told the owner the record had been permanently deleted.
-- Any child carrying `deletedAt` was therefore the subject of a completed
-- erasure request whose data is still present. This removes them for real.
--
-- Edges are deleted explicitly rather than relying on cascades so the intent is
-- readable here, and so the statement order is obvious. Audit rows survive with
-- `childId` set to null by the existing ON DELETE SET NULL — a record that the
-- erasure happened, not a copy of what was erased.

DELETE FROM "album_photos"
WHERE "photoId" IN (
  SELECT p."id"
  FROM "photos" p
  JOIN "photo_tags" t ON t."photoId" = p."id"
  JOIN "children" c ON c."id" = t."childId"
  WHERE c."deletedAt" IS NOT NULL
    AND p."visibility" = 'TAGGED_ONLY'
    AND NOT EXISTS (
      SELECT 1
      FROM "photo_tags" other
      JOIN "children" oc ON oc."id" = other."childId"
      WHERE other."photoId" = p."id"
        AND oc."deletedAt" IS NULL
    )
);

DELETE FROM "photos"
WHERE "id" IN (
  SELECT p."id"
  FROM "photos" p
  JOIN "photo_tags" t ON t."photoId" = p."id"
  JOIN "children" c ON c."id" = t."childId"
  WHERE c."deletedAt" IS NOT NULL
    AND p."visibility" = 'TAGGED_ONLY'
    AND NOT EXISTS (
      SELECT 1
      FROM "photo_tags" other
      JOIN "children" oc ON oc."id" = other."childId"
      WHERE other."photoId" = p."id"
        AND oc."deletedAt" IS NULL
    )
);

DELETE FROM "photo_tags"
WHERE "childId" IN (SELECT "id" FROM "children" WHERE "deletedAt" IS NOT NULL);

DELETE FROM "guardianships"
WHERE "childId" IN (SELECT "id" FROM "children" WHERE "deletedAt" IS NOT NULL);

DELETE FROM "pickup_persons"
WHERE "childId" IN (SELECT "id" FROM "children" WHERE "deletedAt" IS NOT NULL);

DELETE FROM "children" WHERE "deletedAt" IS NOT NULL;
