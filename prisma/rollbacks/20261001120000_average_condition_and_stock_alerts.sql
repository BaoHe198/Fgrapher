-- Rollback for 20261001120000_average_condition_and_stock_alerts.
--
-- DATA LOSS: drops every "Báo cho tôi khi có hàng" request (stock_alerts)
-- and the back-in-stock notifications already sent; products listed as
-- AVERAGE ("Trung bình") are rewritten to FAIR ("Khá"). Roll the
-- application code back first, or the running app will query a table and
-- enum values that no longer exist.
--
-- Afterwards, tell Prisma it is no longer applied (see README step 4):
--   DELETE FROM "_prisma_migrations"
--   WHERE migration_name = '20261001120000_average_condition_and_stock_alerts';
--
-- Postgres cannot drop a single enum value, so both enums are rebuilt.
-- Check what would change first:
--   SELECT count(*) FROM products WHERE condition = 'AVERAGE';
--   SELECT count(*) FROM notifications WHERE type = 'PRODUCT_BACK_IN_STOCK';
--   SELECT count(*) FROM stock_alerts;

BEGIN;

DROP TABLE IF EXISTS "stock_alerts";

UPDATE "products" SET "condition" = 'FAIR' WHERE "condition" = 'AVERAGE';
ALTER TABLE "products" ALTER COLUMN "condition" DROP DEFAULT;
ALTER TYPE "ProductCondition" RENAME TO "ProductCondition_old";
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');
ALTER TABLE "products" ALTER COLUMN "condition" TYPE "ProductCondition" USING "condition"::text::"ProductCondition";
ALTER TABLE "products" ALTER COLUMN "condition" SET DEFAULT 'NEW';
DROP TYPE "ProductCondition_old";

DELETE FROM "notifications" WHERE "type" = 'PRODUCT_BACK_IN_STOCK';
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_REQUEST', 'BOOKING_CONFIRMED', 'BOOKING_DECLINED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'AVAILABILITY_REMINDER', 'BOOKING_RESCHEDULE_PROPOSED', 'BOOKING_COMPLETED', 'NEW_MESSAGE', 'NEW_FOLLOWER', 'NEW_REVIEW', 'NEW_LIKE', 'NEW_COMMENT', 'SUBSCRIPTION_ACTIVE', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_CANCELLED', 'PAYMENT_FAILED', 'NEW_ORDER', 'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'REVIEW_RESPONSE', 'MEDIA_APPROVED', 'MEDIA_REJECTED', 'REQUEST_NEW_MATCH', 'REQUEST_NEW_OFFER', 'REQUEST_OFFER_ACCEPTED', 'REQUEST_OFFER_DECLINED', 'REQUEST_NO_OFFERS_48H', 'ROLE_CHANGE_APPROVED', 'ROLE_CHANGE_REJECTED');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType" USING "type"::text::"NotificationType";
DROP TYPE "NotificationType_old";

COMMIT;
