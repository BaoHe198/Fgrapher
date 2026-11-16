-- An email change now waits for a link sent to the new address before it
-- replaces users.email (see User.pendingEmail in schema.prisma and
-- services/email-verification.ts). Nullable, no default, no backfill.
--
-- Prisma also proposed `DROP INDEX "profiles_serviceKinds_gin"`: that GIN
-- index is created by hand in 20260922044000_require_service_kind_and_no_overlap
-- and is not expressible in schema.prisma, so the diff always wants to drop
-- it. Removed on purpose — it backs the service-kind filter in search.
--
-- Rollback:
--   ALTER TABLE "users" DROP COLUMN "pendingEmail";

ALTER TABLE "users" ADD COLUMN "pendingEmail" TEXT;
