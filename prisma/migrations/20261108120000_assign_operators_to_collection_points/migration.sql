ALTER TABLE "users" ADD COLUMN "collectionPointId" TEXT;
CREATE INDEX "users_collectionPointId_idx" ON "users"("collectionPointId");
ALTER TABLE "users" ADD CONSTRAINT "users_collectionPointId_fkey"
  FOREIGN KEY ("collectionPointId") REFERENCES "collection_points"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve access for the existing public demo operator on this one-time upgrade.
-- Other operators remain unassigned until an administrator assigns them.
UPDATE "users" SET "collectionPointId" = (
  SELECT "id" FROM "collection_points"
  WHERE "contactPhone" = '+254700000201'
  ORDER BY "createdAt", "id" LIMIT 1
)
WHERE "phoneNumber" = '+254700000102' AND "firstName" = 'Demo'
  AND "lastName" = 'Operator' AND "role" = 'COLLECTION_POINT';
