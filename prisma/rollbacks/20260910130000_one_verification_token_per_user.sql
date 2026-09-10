-- Rollback for 20260910130000_one_verification_token_per_user.
--
-- No data loss: this only relaxes a uniqueness constraint back to a plain
-- index. Existing tokens are untouched and stay valid.
--
-- Roll the application code back too — createEmailVerificationToken()
-- upserts on userId and needs the unique constraint to be correct.

DROP INDEX IF EXISTS "email_verification_tokens_userId_key";

CREATE INDEX IF NOT EXISTS "email_verification_tokens_userId_idx"
  ON "email_verification_tokens"("userId");
