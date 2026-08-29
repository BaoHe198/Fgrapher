-- AlterTable
ALTER TABLE "profile_media" ADD COLUMN     "albumId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProfileCategory",
    "coverMediaId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "shootDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- DataMigration (Prompt G3, VIỆC 1) — every existing photo must land in an
-- album, never orphaned. Creates one default "Ảnh chưa phân loại" album
-- per profile that currently has at least one photo (category left NULL —
-- see the model comment on Album.category for why), then assigns every
-- one of that profile's photos into it. Asserts the total profile_media
-- row count is unchanged before/after (this loop only ever sets albumId
-- on existing rows, never inserts/deletes one) — a mismatch aborts the
-- whole migration transaction rather than silently losing a photo.
DO $$
DECLARE
  profile_row RECORD;
  new_album_id TEXT;
  before_count INTEGER;
  after_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO before_count FROM "profile_media";

  FOR profile_row IN
    SELECT DISTINCT "profileId" FROM "profile_media" WHERE "albumId" IS NULL
  LOOP
    new_album_id := gen_random_uuid()::text;
    INSERT INTO "albums" ("id", "profileId", "title", "category", "sortOrder", "isPublished", "createdAt", "updatedAt")
    VALUES (new_album_id, profile_row."profileId", 'Ảnh chưa phân loại', NULL, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    UPDATE "profile_media"
    SET "albumId" = new_album_id
    WHERE "profileId" = profile_row."profileId" AND "albumId" IS NULL;
  END LOOP;

  SELECT COUNT(*) INTO after_count FROM "profile_media";
  IF before_count != after_count THEN
    RAISE EXCEPTION 'Album migration changed profile_media row count: % before, % after — aborting', before_count, after_count;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX "albums_profileId_sortOrder_idx" ON "albums"("profileId", "sortOrder");

-- CreateIndex
CREATE INDEX "albums_deletedAt_idx" ON "albums"("deletedAt");

-- CreateIndex
CREATE INDEX "profile_media_albumId_idx" ON "profile_media"("albumId");

-- CreateIndex
CREATE INDEX "profile_media_deletedAt_idx" ON "profile_media"("deletedAt");

-- AddForeignKey
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "profile_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
