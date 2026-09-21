-- AlterTable
ALTER TABLE "product_images" ADD COLUMN     "autoFlagReason" TEXT,
ADD COLUMN     "autoFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedBy" TEXT,
ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "product_images_moderationStatus_id_idx" ON "product_images"("moderationStatus", "id");
