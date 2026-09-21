-- Every product image that existed before moderation was introduced is
-- treated as already approved, exactly as the ProfileMedia migration did.
-- Without this, turning moderation on would blank out every shop's photos
-- retroactively, which is not what "new uploads need review" means.
UPDATE "product_images"
SET "moderationStatus" = 'APPROVED',
    "moderatedAt" = NOW()
WHERE "moderationStatus" = 'PENDING';
