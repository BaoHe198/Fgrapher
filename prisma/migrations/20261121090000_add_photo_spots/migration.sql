-- Photo spots on Fmap (project owner, 20/11/2026): "địa điểm chụp đẹp" that
-- verified providers and admins propose, an admin approves, and albums can be
-- tagged with ("Chụp tại"), so a spot leads to the people who shoot there.
--
--   places               the spots (admin-reviewed; soft delete; merge link)
--   place_media          their photos (moderated like portfolio photos)
--   albums.placeId       which spot an album was shot at (optional)
--   NotificationType     PLACE_APPROVED / PLACE_REJECTED for the proposer
--
-- Additive only: two new empty tables, one nullable column, two enum
-- values. No existing row changes, and a build from before this migration
-- never reads any of it.
--
-- Hand-written from `prisma migrate diff`, like the migrations before it:
-- the diff also proposes `DROP INDEX "profiles_serviceKinds_gin"`, an index
-- made by hand in 20260922044000 that schema.prisma cannot express.
--
-- Rollback (loses every spot, spot photo and album tag):
--   ALTER TABLE "albums" DROP CONSTRAINT "albums_placeId_fkey";
--   DROP INDEX "albums_placeId_idx";
--   ALTER TABLE "albums" DROP COLUMN "placeId";
--   ALTER TABLE "places" DROP CONSTRAINT "places_coverMediaId_fkey";
--   DROP TABLE "place_media";
--   DROP TABLE "places";
--   DROP TYPE "PlaceOperatingStatus";
--   DROP TYPE "PlaceKind";
-- The two NotificationType values cannot be dropped in place; they are
-- harmless when unused. To remove them, delete the notifications that use
-- them and rebuild the type as 20261119120000 describes.

-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('OLD_QUARTER', 'STREET', 'CAFE', 'PARK', 'BEACH', 'MOUNTAIN', 'FIELD', 'LAKE_RIVER', 'HERITAGE', 'ARCHITECTURE', 'COUNTRYSIDE', 'TOURIST_AREA', 'OTHER');

-- CreateEnum
CREATE TYPE "PlaceOperatingStatus" AS ENUM ('OPEN', 'TEMPORARILY_CLOSED', 'NO_SHOOTING');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PLACE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PLACE_REJECTED';

-- AlterTable
ALTER TABLE "albums" ADD COLUMN     "placeId" TEXT;

-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "PlaceKind" NOT NULL,
    "categories" "ProfileCategory"[],
    "provinceId" TEXT NOT NULL,
    "wardId" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "bestTimeNote" TEXT,
    "bestMonths" INTEGER[],
    "entryFeeVnd" INTEGER,
    "feeNote" TEXT,
    "permitRequired" BOOLEAN,
    "rulesNote" TEXT,
    "crowdNote" TEXT,
    "parkingNote" TEXT,
    "operatingStatus" "PlaceOperatingStatus" NOT NULL DEFAULT 'OPEN',
    "statusNote" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "reviewStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "coverMediaId" TEXT,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_media" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "rightsConfirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "place_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "places_coverMediaId_key" ON "places"("coverMediaId");

-- CreateIndex
CREATE INDEX "places_reviewStatus_createdAt_idx" ON "places"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "places_provinceId_reviewStatus_idx" ON "places"("provinceId", "reviewStatus");

-- CreateIndex
CREATE INDEX "places_latitude_longitude_idx" ON "places"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "places_submittedById_idx" ON "places"("submittedById");

-- CreateIndex
CREATE INDEX "places_deletedAt_idx" ON "places"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "places_provinceId_slug_key" ON "places"("provinceId", "slug");

-- CreateIndex
CREATE INDEX "place_media_placeId_order_idx" ON "place_media"("placeId", "order");

-- CreateIndex
CREATE INDEX "place_media_moderationStatus_createdAt_idx" ON "place_media"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "place_media_uploaderId_idx" ON "place_media"("uploaderId");

-- CreateIndex
CREATE INDEX "albums_placeId_idx" ON "albums"("placeId");

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "place_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_media" ADD CONSTRAINT "place_media_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_media" ADD CONSTRAINT "place_media_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
