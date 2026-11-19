-- A provider was never told when their identity documents were approved or
-- rejected: reviewVerification() changed the status and notified nobody, so
-- the only way to find out was to keep opening the dashboard (found in the
-- 19/11/2026 walkthrough; approved by the project owner the same day).
-- These two values let services/admin.ts send that notification.
--
-- Additive only: no existing row changes, and nothing writes the new values
-- until the code that knows them is deployed. A build from before this
-- migration only breaks on reading a notification of one of these types,
-- which such a build never creates.
--
-- Hand-written, like 20261116130000_add_user_pending_email: `prisma migrate
-- dev` also proposes `DROP INDEX "profiles_serviceKinds_gin"`, an index made
-- by hand in 20260922044000 that schema.prisma cannot express.
--
-- Rollback: PostgreSQL cannot drop a value from an enum. The values are
-- harmless when unused, so the rollback is to revert the code and leave
-- them. To remove them completely, first delete the rows that use them,
-- then rebuild the type:
--   DELETE FROM "notifications"
--     WHERE "type" IN ('VERIFICATION_APPROVED', 'VERIFICATION_REJECTED');
--   ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
--   CREATE TYPE "NotificationType" AS ENUM (<every value except these two>);
--   ALTER TABLE "notifications" ALTER COLUMN "type"
--     TYPE "NotificationType" USING "type"::text::"NotificationType";
--   DROP TYPE "NotificationType_old";

ALTER TYPE "NotificationType" ADD VALUE 'VERIFICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'VERIFICATION_REJECTED';
