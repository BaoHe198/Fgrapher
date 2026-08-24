/*
  Warnings:

  - You are about to drop the column `provinceCode` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "provinceCode",
ADD COLUMN     "provinceId" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "provinceId" TEXT,
ADD COLUMN     "servesNationwide" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wardId" TEXT;

-- CreateTable
CREATE TABLE "profile_service_areas" (
    "profileId" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_service_areas_pkey" PRIMARY KEY ("profileId","provinceId")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_service_areas_provinceId_idx" ON "profile_service_areas"("provinceId");

-- CreateIndex
CREATE INDEX "waitlist_entries_provinceId_role_idx" ON "waitlist_entries"("provinceId", "role");

-- CreateIndex
CREATE INDEX "profiles_role_isPublished_provinceId_idx" ON "profiles"("role", "isPublished", "provinceId");

-- CreateIndex
CREATE INDEX "profiles_provinceId_priceMin_idx" ON "profiles"("provinceId", "priceMin");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_service_areas" ADD CONSTRAINT "profile_service_areas_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_service_areas" ADD CONSTRAINT "profile_service_areas_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
