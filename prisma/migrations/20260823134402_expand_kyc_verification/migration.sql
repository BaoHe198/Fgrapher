-- AlterEnum
ALTER TYPE "ConsentPurpose" ADD VALUE 'IDENTITY_VERIFICATION';

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "idNumberHash" TEXT,
ADD COLUMN     "purgeAfter" TIMESTAMP(3),
ADD COLUMN     "verificationIdBackPublicId" TEXT,
ADD COLUMN     "verificationIdBackUrl" TEXT,
ADD COLUMN     "verificationSelfiePublicId" TEXT,
ADD COLUMN     "verificationSelfieUrl" TEXT;

-- CreateIndex
CREATE INDEX "user_roles_verificationStatus_createdAt_idx" ON "user_roles"("verificationStatus", "createdAt");
