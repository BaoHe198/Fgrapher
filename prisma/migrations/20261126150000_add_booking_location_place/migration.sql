-- A booking can name a photo spot as where the shoot is (project owner,
-- 26/11/2026: "khi đặt lịch, cho chọn một điểm chụp ảnh có sẵn làm địa điểm").
--
--   bookings.locationPlaceId   nullable, -> places, ON DELETE SET NULL
--
-- The customer picks an approved spot for an outdoor shoot; its name and
-- address fill the address field, its province and ward fill the area. The
-- link itself is what this column keeps, so the booking can point to the
-- spot's page. It is part of where the shoot is, and is released to the
-- provider under the same rule as the address: once they have accepted.
--
-- Additive only: one nullable column, one index, one foreign key. No
-- existing row changes, and a build from before this migration never reads
-- the column.
--
-- Hand-written from `prisma migrate diff`, like the migrations before it:
-- the diff also proposes `DROP INDEX "profiles_serviceKinds_gin"`, an index
-- made by hand in 20260922044000 that schema.prisma cannot express.
--
-- Rollback (loses which spot a booking named; its address text stays):
--   ALTER TABLE "bookings" DROP CONSTRAINT "bookings_locationPlaceId_fkey";
--   DROP INDEX "bookings_locationPlaceId_idx";
--   ALTER TABLE "bookings" DROP COLUMN "locationPlaceId";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "locationPlaceId" TEXT;

-- CreateIndex
CREATE INDEX "bookings_locationPlaceId_idx" ON "bookings"("locationPlaceId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_locationPlaceId_fkey" FOREIGN KEY ("locationPlaceId") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;
