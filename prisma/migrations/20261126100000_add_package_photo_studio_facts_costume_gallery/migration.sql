-- Three things the role walk-through of 25/11/2026 asked for, each needing a
-- place to be stored (items 8, 17, 18 of the suggestion list):
--
--   services.coverMediaId        nullable, -> profile_media
--     The photo a package card shows, chosen by the provider. Without one
--     the card keeps taking a portfolio photo by position.
--
--   profiles.roomCount           nullable
--   profiles.capacity            nullable
--     What a customer asks a studio before renting it: how many rooms or
--     sets, and how many people fit.
--
--   profile_media.costumeItemId  nullable, -> costume_items
--     Further photos of one outfit, after its main photo
--     (costume_items.mediaId, unchanged). Each is an ordinary portfolio
--     photo and still goes through the moderation queue.
--
-- Additive only: four nullable columns, two indexes, two foreign keys with
-- ON DELETE SET NULL. No existing row changes, and a build from before this
-- migration never reads any of the four.
--
-- Hand-written from `prisma migrate diff`, like the migrations before it:
-- the diff also proposes `DROP INDEX "profiles_serviceKinds_gin"`, an index
-- made by hand in 20260922044000 that schema.prisma cannot express.
--
-- Rollback (loses chosen package photos, studio room/capacity figures and
-- the extra photos' link to their outfit; the photos themselves stay):
--   ALTER TABLE "services" DROP CONSTRAINT "services_coverMediaId_fkey";
--   ALTER TABLE "profile_media" DROP CONSTRAINT "profile_media_costumeItemId_fkey";
--   DROP INDEX "services_coverMediaId_idx";
--   DROP INDEX "profile_media_costumeItemId_idx";
--   ALTER TABLE "services" DROP COLUMN "coverMediaId";
--   ALTER TABLE "profiles" DROP COLUMN "capacity";
--   ALTER TABLE "profiles" DROP COLUMN "roomCount";
--   ALTER TABLE "profile_media" DROP COLUMN "costumeItemId";

-- AlterTable
ALTER TABLE "profile_media" ADD COLUMN     "costumeItemId" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "roomCount" INTEGER;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "coverMediaId" TEXT;

-- CreateIndex
CREATE INDEX "profile_media_costumeItemId_idx" ON "profile_media"("costumeItemId");

-- CreateIndex
CREATE INDEX "services_coverMediaId_idx" ON "services"("coverMediaId");

-- AddForeignKey
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_costumeItemId_fkey" FOREIGN KEY ("costumeItemId") REFERENCES "costume_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "profile_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
