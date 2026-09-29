-- Rollback for 20260929120000_add_redesign_profile_fields.
--
-- DATA LOSS: drops what providers typed into the new profile fields
-- (years of experience, deposit / cancellation / reschedule policy, travel
-- radius) and package deliverables. Roll the application code back first,
-- or the running app will query columns that no longer exist.
--
-- Afterwards, tell Prisma it is no longer applied (see README step 4):
--   DELETE FROM "_prisma_migrations"
--   WHERE migration_name = '20260929120000_add_redesign_profile_fields';
--
-- Postgres cannot drop a single enum value, so YEARBOOK is removed by
-- rebuilding the type. Any row still using YEARBOOK is rewritten to
-- PORTRAIT first; check what would change:
--   SELECT count(*) FROM albums WHERE category = 'YEARBOOK';
--   SELECT count(*) FROM profiles WHERE 'YEARBOOK' = ANY(categories);

BEGIN;

ALTER TABLE "services" DROP COLUMN IF EXISTS "deliveryDays",
  DROP COLUMN IF EXISTS "editedPhotoCount";

ALTER TABLE "profiles" DROP COLUMN IF EXISTS "cancellationPolicy",
  DROP COLUMN IF EXISTS "depositPercent",
  DROP COLUMN IF EXISTS "depositPolicy",
  DROP COLUMN IF EXISTS "reschedulePolicy",
  DROP COLUMN IF EXISTS "serviceRadiusKm",
  DROP COLUMN IF EXISTS "yearsExperience";

UPDATE "albums" SET "category" = 'PORTRAIT' WHERE "category" = 'YEARBOOK';
UPDATE "costume_items" SET "category" = NULL WHERE "category" = 'YEARBOOK';
UPDATE "profiles"
  SET "categories" = array_replace("categories", 'YEARBOOK'::"ProfileCategory", 'PORTRAIT'::"ProfileCategory")
  WHERE 'YEARBOOK' = ANY("categories");
UPDATE "service_requests"
  SET "categories" = array_replace("categories", 'YEARBOOK'::"ProfileCategory", 'PORTRAIT'::"ProfileCategory")
  WHERE 'YEARBOOK' = ANY("categories");

ALTER TYPE "ProfileCategory" RENAME TO "ProfileCategory_old";
CREATE TYPE "ProfileCategory" AS ENUM ('WEDDING', 'PORTRAIT', 'FASHION', 'COMMERCIAL', 'EVENT', 'PRODUCT', 'FOOD', 'LANDSCAPE', 'STREET', 'DOCUMENTARY', 'MUSIC_VIDEO', 'CORPORATE', 'REAL_ESTATE', 'BRIDAL', 'EDITORIAL', 'SFX', 'NATURAL', 'GLAM', 'INDOOR', 'OUTDOOR', 'ROOFTOP', 'CYCLORAMA', 'GREEN_SCREEN', 'FASHION_MODEL', 'COMMERCIAL_MODEL', 'FITNESS_MODEL', 'PORTRAIT_MODEL', 'HAND_FOOT_MODEL', 'PLUS_SIZE', 'PETITE', 'MATURE', 'ALTERNATIVE', 'AO_DAI', 'WEDDING_DRESS', 'MENSWEAR', 'EVENING_GOWN', 'HISTORICAL', 'COSPLAY', 'KIDSWEAR', 'ACCESSORIES');
ALTER TABLE "albums" ALTER COLUMN "category" TYPE "ProfileCategory" USING "category"::text::"ProfileCategory";
ALTER TABLE "costume_items" ALTER COLUMN "category" TYPE "ProfileCategory" USING "category"::text::"ProfileCategory";
ALTER TABLE "profiles" ALTER COLUMN "categories" TYPE "ProfileCategory"[] USING "categories"::text[]::"ProfileCategory"[];
ALTER TABLE "service_requests" ALTER COLUMN "categories" TYPE "ProfileCategory"[] USING "categories"::text[]::"ProfileCategory"[];
DROP TYPE "ProfileCategory_old";

COMMIT;
