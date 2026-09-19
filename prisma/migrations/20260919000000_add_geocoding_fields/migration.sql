CREATE TYPE "GeocodingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

ALTER TABLE "profiles"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "geocodedAt" TIMESTAMP(3),
  ADD COLUMN "geocodeAddressHash" TEXT,
  ADD COLUMN "geocodingStatus" "GeocodingStatus" NOT NULL DEFAULT 'PENDING';

-- Existing profiles predate public map markers. Keep their exact service
-- address private until each provider explicitly opts into an exact pin.
UPDATE "profiles" SET "hideExactLocation" = true;
ALTER TABLE "profiles" ALTER COLUMN "hideExactLocation" SET DEFAULT true;

CREATE INDEX "profiles_latitude_longitude_idx"
  ON "profiles"("latitude", "longitude");

CREATE INDEX "bookings_providerId_date_status_idx"
  ON "bookings"("providerId", "date", "status");
