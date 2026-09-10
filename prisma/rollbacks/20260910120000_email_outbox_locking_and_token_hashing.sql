-- Rollback for 20260910120000_email_outbox_locking_and_token_hashing.
--
-- DATA LOSS: drops every outstanding email-verification token (the hashes
-- cannot be turned back into the raw tokens the old column held). Rows in
-- email_outbox survive; their lockedAt values do not.
--
-- Postgres cannot remove a value from an enum type, so "SENDING" is left
-- in place. It is harmless: the rolled-back code never writes it. Any row
-- sitting in SENDING at rollback time is returned to PENDING below so it
-- is still picked up by the old processor.

-- Return in-flight claims to the queue before SENDING becomes unreadable
-- to the rolled-back code.
UPDATE "email_outbox"
SET "status" = 'PENDING', "nextAttemptAt" = now()
WHERE "status" = 'SENDING';

-- The old column was NOT NULL; terminal rows written by the new code have
-- no schedule, so give them one before restoring the constraint.
UPDATE "email_outbox"
SET "nextAttemptAt" = COALESCE("sentAt", "updatedAt", now())
WHERE "nextAttemptAt" IS NULL;

DROP INDEX IF EXISTS "email_outbox_status_lockedAt_idx";

ALTER TABLE "email_outbox"
  DROP COLUMN IF EXISTS "lockedAt",
  ALTER COLUMN "nextAttemptAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "email_outbox_idempotencyKey_idx"
  ON "email_outbox"("idempotencyKey");

-- Hashes are one-way; there is nothing to convert back into raw tokens.
DELETE FROM "email_verification_tokens";

DROP INDEX IF EXISTS "email_verification_tokens_tokenHash_key";

ALTER TABLE "email_verification_tokens"
  DROP COLUMN IF EXISTS "tokenHash",
  ADD COLUMN "token" TEXT NOT NULL;

CREATE UNIQUE INDEX "email_verification_tokens_token_key"
  ON "email_verification_tokens"("token");
