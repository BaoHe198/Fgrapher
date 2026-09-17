-- PostgreSQL requires enum additions to commit before a new value can be
-- referenced by a column default, so this deliberately follows the enum-only
-- migration in a separate transaction.
ALTER TABLE "service_requests"
  ADD COLUMN "moderationReason" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
