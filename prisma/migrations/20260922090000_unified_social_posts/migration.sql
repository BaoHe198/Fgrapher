-- Make Community F a shared social surface for ordinary posts, portfolio
-- albums and approved service requests. Likes/comments stay on one Post row,
-- so the counters shown in Portfolio and the news feed cannot diverge.
CREATE TYPE "PostKind" AS ENUM ('STANDARD', 'PORTFOLIO_ALBUM', 'SERVICE_REQUEST');

ALTER TABLE "posts"
  ADD COLUMN "kind" "PostKind" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "albumId" TEXT,
  ADD COLUMN "serviceRequestId" TEXT;

CREATE UNIQUE INDEX "posts_albumId_key" ON "posts"("albumId");
CREATE UNIQUE INDEX "posts_serviceRequestId_key" ON "posts"("serviceRequestId");
CREATE INDEX "posts_kind_createdAt_id_idx" ON "posts"("kind", "createdAt", "id");

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_albumId_fkey"
  FOREIGN KEY ("albumId") REFERENCES "albums"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing public portfolio albums become feed posts without duplicating
-- their media. Feed visibility still requires at least one approved photo.
INSERT INTO "posts" (
  "id", "userId", "kind", "albumId", "createdAt", "updatedAt",
  "likeCount", "commentCount"
)
SELECT
  CONCAT('album_social_', album."id"),
  profile."userId",
  'PORTFOLIO_ALBUM'::"PostKind",
  album."id",
  album."createdAt",
  album."updatedAt",
  0,
  0
FROM "albums" album
JOIN "profiles" profile ON profile."id" = album."profileId"
WHERE album."deletedAt" IS NULL
ON CONFLICT ("albumId") DO NOTHING;

-- Only requests already approved by an admin enter the public feed.
INSERT INTO "posts" (
  "id", "userId", "kind", "serviceRequestId", "createdAt", "updatedAt",
  "likeCount", "commentCount"
)
SELECT
  CONCAT('request_social_', request."id"),
  request."customerId",
  'SERVICE_REQUEST'::"PostKind",
  request."id",
  request."createdAt",
  request."updatedAt",
  0,
  0
FROM "service_requests" request
WHERE request."isDraft" = false
  AND request."status" NOT IN ('PENDING_REVIEW', 'REJECTED')
ON CONFLICT ("serviceRequestId") DO NOTHING;
