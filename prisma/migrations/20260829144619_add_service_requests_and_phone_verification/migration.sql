-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'HAS_OFFERS', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_NEW_MATCH';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_NEW_OFFER';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_OFFER_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_OFFER_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_NO_OFFERS_48H';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "role" "Role" NOT NULL,
    "categories" "ProfileCategory"[],
    "shootDate" DATE,
    "isDateFlexible" BOOLEAN NOT NULL DEFAULT false,
    "dateRangeStart" DATE,
    "dateRangeEnd" DATE,
    "provinceId" TEXT NOT NULL,
    "areaNote" TEXT,
    "detailedAddress" TEXT,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "fulfilledByOfferId" TEXT,
    "bookingId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "noOffersNudgedAt" TIMESTAMP(3),
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_references" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_offers" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "message" TEXT,
    "proposedPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "proposedDate" DATE,
    "status" "RequestOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_code_key" ON "service_requests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_fulfilledByOfferId_key" ON "service_requests"("fulfilledByOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_bookingId_key" ON "service_requests"("bookingId");

-- CreateIndex
CREATE INDEX "service_requests_customerId_status_idx" ON "service_requests"("customerId", "status");

-- CreateIndex
CREATE INDEX "service_requests_role_provinceId_status_idx" ON "service_requests"("role", "provinceId", "status");

-- CreateIndex
CREATE INDEX "service_requests_status_expiresAt_idx" ON "service_requests"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "service_request_references_requestId_idx" ON "service_request_references"("requestId");

-- CreateIndex
CREATE INDEX "request_offers_providerId_status_idx" ON "request_offers"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "request_offers_requestId_providerId_key" ON "request_offers"("requestId", "providerId");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_fulfilledByOfferId_fkey" FOREIGN KEY ("fulfilledByOfferId") REFERENCES "request_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_references" ADD CONSTRAINT "service_request_references_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_offers" ADD CONSTRAINT "request_offers_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_offers" ADD CONSTRAINT "request_offers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
