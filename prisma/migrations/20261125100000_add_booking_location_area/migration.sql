-- The area of a shoot, as a province and a ward (project owner, 25/11/2026).
--
-- A provider deciding on a request saw only "Ngoài trời / khác": the address
-- is withheld until they accept, and it was the only place the location was
-- written. They could not tell whether the job was in their own city, and a
-- model was asked to agree without knowing the area. The customer now picks
-- the province (and ward) with the address; the provider sees those two
-- before accepting, the street address after, as before.
--
--   bookings.locationProvinceId   nullable, -> provinces
--   bookings.locationWardId       nullable, -> wards
--
-- Additive only: two nullable columns. No existing row changes; older
-- bookings and bookings at the provider's own place keep both NULL. A build
-- from before this migration never reads either column.
--
-- Hand-written from `prisma migrate diff`, like the migrations before it:
-- the diff also proposes `DROP INDEX "profiles_serviceKinds_gin"`, an index
-- made by hand in 20260922044000 that schema.prisma cannot express.
--
-- Rollback (loses the area picked on bookings made since):
--   ALTER TABLE "bookings" DROP CONSTRAINT "bookings_locationWardId_fkey";
--   ALTER TABLE "bookings" DROP CONSTRAINT "bookings_locationProvinceId_fkey";
--   ALTER TABLE "bookings" DROP COLUMN "locationWardId";
--   ALTER TABLE "bookings" DROP COLUMN "locationProvinceId";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "locationProvinceId" TEXT,
ADD COLUMN     "locationWardId" TEXT;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_locationProvinceId_fkey" FOREIGN KEY ("locationProvinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_locationWardId_fkey" FOREIGN KEY ("locationWardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
