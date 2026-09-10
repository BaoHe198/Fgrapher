-- Enforce at most one outstanding email-verification token per user.
--
-- Issuing a new link is meant to invalidate the previous one. Doing that
-- as delete-then-insert leaves two live tokens whenever two requests
-- overlap, because each deletes against its own snapshot. With this
-- constraint the write becomes an upsert on userId and the database
-- guarantees the invariant instead of the application racing for it.
--
-- Rollback: see prisma/rollbacks/.

-- Defensive: the unique index below fails if duplicates already exist.
-- Keeps the newest token per user and drops the rest. Expected to affect
-- zero rows — no token has been issued before this release.
DELETE FROM "email_verification_tokens" a
USING "email_verification_tokens" b
WHERE a."userId" = b."userId"
  AND (a."createdAt" < b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" < b."id"));

-- DropIndex
DROP INDEX "email_verification_tokens_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_userId_key" ON "email_verification_tokens"("userId");
