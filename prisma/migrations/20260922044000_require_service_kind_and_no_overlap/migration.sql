/*
  Warnings:

  - Made the column `kind` on table `services` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "booking_allocations" ALTER COLUMN "startAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "endAt" SET DATA TYPE TIMESTAMPTZ(3);

-- Fill any row the backfill script has not reached before requiring the
-- column, so `prisma migrate deploy` is safe on an environment where the
-- script has not been run yet (production, above all). Idempotent: it only
-- touches rows that are still NULL, and it derives the kind from the owning
-- profile's role — the same mapping the script uses.
UPDATE "services" s
SET "kind" = CASE p."role"
  WHEN 'PHOTOGRAPHER'  THEN 'PHOTOGRAPHY'::"ServiceKind"
  WHEN 'VIDEOGRAPHER'  THEN 'VIDEOGRAPHY'::"ServiceKind"
  WHEN 'MAKEUP_ARTIST' THEN 'MAKEUP'::"ServiceKind"
  WHEN 'MODEL'         THEN 'MODELING'::"ServiceKind"
  WHEN 'STUDIO'        THEN 'VENUE_RENTAL'::"ServiceKind"
END
FROM "profiles" p
WHERE s."profileId" = p."id" AND s."kind" IS NULL AND p."role" IN
  ('PHOTOGRAPHER','VIDEOGRAPHER','MAKEUP_ARTIST','MODEL','STUDIO');

-- A package owned by a role that offers no services at all cannot be given a
-- kind, and cannot be left NULL either. There should be none; deleting is
-- safer than inventing a kind, and the count appears in the migration output.
DELETE FROM "services" WHERE "kind" IS NULL;

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "kind" SET NOT NULL;

-- CreateIndex
CREATE INDEX "profiles_provinceId_isPublished_idx" ON "profiles"("provinceId", "isPublished");

-- Array-membership search ("who offers PHOTOGRAPHY") needs a GIN index or it
-- degrades into a sequential scan once the table has real data.
CREATE INDEX IF NOT EXISTS "profiles_serviceKinds_gin"
  ON "profiles" USING gin ("serviceKinds");

-- Double-booking prevention that a race cannot get around. Two concurrent
-- requests can both pass an application-level "is this slot free?" check;
-- only the database can refuse the second write.
--
-- Unconditional on purpose: a booking_allocations row exists ONLY while its
-- booking is actually holding the slot, and transitionBooking deletes it once
-- the booking is cancelled, declined, expired or completed. A WHERE clause
-- over booking status would have to be kept in step with that state machine,
-- which is the part that would eventually drift.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "booking_allocations"
  ADD CONSTRAINT "booking_allocations_no_overlap"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  );
