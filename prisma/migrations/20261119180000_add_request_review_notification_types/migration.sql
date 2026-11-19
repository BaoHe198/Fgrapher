-- A customer was never told what became of an F Booking request after
-- posting it: reviewServiceRequest() approved or rejected it and notified
-- only the matching providers, and expireOverdueRequests() closed it in
-- silence. A rejected request in particular just sat in "Yêu cầu của tôi"
-- with the reviewer's reason on it, unseen unless the customer came back to
-- look (found in the 19/11/2026 walkthrough). These three values let
-- services/service-requests.ts tell the customer.
--
-- Additive only: no existing row changes, and nothing writes the new values
-- until the code that knows them is deployed. A build from before this
-- migration only breaks on reading a notification of one of these types,
-- which such a build never creates.
--
-- Hand-written, like 20261119120000_add_verification_notification_types:
-- `prisma migrate dev` also proposes `DROP INDEX "profiles_serviceKinds_gin"`,
-- an index made by hand in 20260922044000 that schema.prisma cannot express.
--
-- Rollback: PostgreSQL cannot drop a value from an enum. The values are
-- harmless when unused, so the rollback is to revert the code and leave
-- them. To remove them completely, first delete the rows that use them,
-- then rebuild the type:
--   DELETE FROM "notifications"
--     WHERE "type" IN ('REQUEST_APPROVED', 'REQUEST_REJECTED', 'REQUEST_EXPIRED');
--   ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
--   CREATE TYPE "NotificationType" AS ENUM (<every value except these three>);
--   ALTER TABLE "notifications" ALTER COLUMN "type"
--     TYPE "NotificationType" USING "type"::text::"NotificationType";
--   DROP TYPE "NotificationType_old";

ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_EXPIRED';
