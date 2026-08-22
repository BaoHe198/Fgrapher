-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('NORMAL', 'HIGH');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "depositPaid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "contentGuidelinesAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "hideExactLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireDepositBeforeContact" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "priority" "ReportPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "verificationIdPublicId" TEXT,
ADD COLUMN     "verificationIdUrl" TEXT,
ADD COLUMN     "verificationRejectedReason" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dateOfBirth" DATE;

-- CreateIndex
CREATE INDEX "reports_priority_status_idx" ON "reports"("priority", "status");
