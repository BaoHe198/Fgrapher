-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MOMO', 'ZALOPAY', 'BANK_TRANSFER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'AWAITING_REVIEW';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "interval" TEXT,
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "providerTransactionId" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "role" "Role",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "stripePaymentId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerOrderId_key" ON "payments"("providerOrderId");

-- CreateIndex
CREATE INDEX "payments_provider_status_idx" ON "payments"("provider", "status");

