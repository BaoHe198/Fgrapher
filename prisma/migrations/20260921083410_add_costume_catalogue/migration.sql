-- CreateTable
CREATE TABLE "costume_items" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProfileCategory",
    "rentalPricePerDay" DOUBLE PRECISION NOT NULL,
    "depositAmount" DOUBLE PRECISION,
    "size" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "costume_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "costume_items_profileId_sortOrder_idx" ON "costume_items"("profileId", "sortOrder");

-- CreateIndex
CREATE INDEX "costume_items_deletedAt_idx" ON "costume_items"("deletedAt");

-- AddForeignKey
ALTER TABLE "costume_items" ADD CONSTRAINT "costume_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costume_items" ADD CONSTRAINT "costume_items_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "profile_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
