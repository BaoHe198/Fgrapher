-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('PHOTOGRAPHY', 'VIDEOGRAPHY', 'VENUE_RENTAL', 'MAKEUP', 'MODELING');

-- CreateEnum
CREATE TYPE "LegalEntityType" AS ENUM ('INDIVIDUAL', 'HOUSEHOLD_BUSINESS', 'COMPANY');

-- CreateEnum
CREATE TYPE "OperatingMode" AS ENUM ('SOLO', 'TEAM');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PROVIDER_SELF', 'ROOM', 'STAFF', 'EQUIPMENT');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "startAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "operatingMode" "OperatingMode",
ADD COLUMN     "serviceKinds" "ServiceKind"[];

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "kind" "ServiceKind";

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "legalEntityConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "legalEntityType" "LegalEntityType";

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT NOT NULL,
    "provinceId" TEXT,
    "wardId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookable_resources" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL DEFAULT 'PROVIDER_SELF',
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookable_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_blocks" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_allocations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venues_profileId_idx" ON "venues"("profileId");

-- CreateIndex
CREATE INDEX "venues_provinceId_idx" ON "venues"("provinceId");

-- CreateIndex
CREATE INDEX "bookable_resources_profileId_isActive_idx" ON "bookable_resources"("profileId", "isActive");

-- CreateIndex
CREATE INDEX "availability_rules_resourceId_dayOfWeek_idx" ON "availability_rules"("resourceId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "availability_blocks_resourceId_startAt_idx" ON "availability_blocks"("resourceId", "startAt");

-- CreateIndex
CREATE INDEX "booking_allocations_resourceId_startAt_idx" ON "booking_allocations"("resourceId", "startAt");

-- CreateIndex
CREATE INDEX "booking_allocations_bookingId_idx" ON "booking_allocations"("bookingId");

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookable_resources" ADD CONSTRAINT "bookable_resources_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "bookable_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "bookable_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_allocations" ADD CONSTRAINT "booking_allocations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_allocations" ADD CONSTRAINT "booking_allocations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "bookable_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
