-- "Bảng ý tưởng": photos a signed-in visitor pins to send an artist as a
-- brief (see SavedMedia in schema.prisma and services/moodboard.ts). A new,
-- empty table; nothing existing is changed.
--
-- Prisma also proposes `DROP INDEX "profiles_serviceKinds_gin"` on every
-- diff (hand-made GIN index, not expressible in schema.prisma). Left out on
-- purpose, as in the earlier migrations.
--
-- Rollback:
--   DROP TABLE "saved_media";

CREATE TABLE "saved_media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_media_mediaId_idx" ON "saved_media"("mediaId");

CREATE UNIQUE INDEX "saved_media_userId_mediaId_key" ON "saved_media"("userId", "mediaId");

ALTER TABLE "saved_media" ADD CONSTRAINT "saved_media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_media" ADD CONSTRAINT "saved_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "profile_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
