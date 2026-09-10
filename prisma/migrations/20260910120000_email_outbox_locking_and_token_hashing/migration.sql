-- Email outbox: add a SENDING claim state so concurrent cron runs can't
-- both deliver the same row, make nextAttemptAt nullable so terminal rows
-- (SENT/FAILED) carry no phantom schedule, and drop the redundant
-- idempotencyKey index (the UNIQUE constraint already provides one).
--
-- Email verification tokens: store a SHA-256 hash instead of the raw
-- token. The table has never been written to (the migration that created
-- it shipped ahead of the feature), so the column is replaced outright
-- rather than backfilled — a raw token could not be converted to its hash
-- and re-issued anyway.
--
-- Rollback: see down.sql in this directory.

-- AlterEnum
ALTER TYPE "EmailOutboxStatus" ADD VALUE 'SENDING';

-- DropIndex
DROP INDEX "email_outbox_idempotencyKey_idx";

-- AlterTable
ALTER TABLE "email_outbox" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ALTER COLUMN "nextAttemptAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "email_outbox_status_lockedAt_idx" ON "email_outbox"("status", "lockedAt");

-- Guard for the NOT NULL column below. Expected to affect zero rows: no
-- application code has ever inserted into this table.
DELETE FROM "email_verification_tokens";

-- DropIndex
DROP INDEX "email_verification_tokens_token_key";

-- AlterTable
ALTER TABLE "email_verification_tokens" DROP COLUMN "token",
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");
