-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_REJECTED');

-- AlterTable
ALTER TABLE "profile_media" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedBy" TEXT,
ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "rightsConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "violationPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "profile_media_moderationStatus_createdAt_idx" ON "profile_media"("moderationStatus", "createdAt");

-- Backfill: every row that existed before moderation was enforced is
-- already live in production, so treat it as already-approved rather
-- than yanking it out of search/profiles by defaulting to PENDING.
UPDATE "profile_media" SET "moderationStatus" = 'APPROVED';
