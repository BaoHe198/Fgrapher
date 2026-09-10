-- Let the outbox stop storing credential-bearing bodies once they can no
-- longer be sent.
--
-- The outbox stores the rendered email, and password-reset and
-- email-verification emails embed a live token in that body. Hashing the
-- token in email_verification_tokens is worth nothing if the raw link sits
-- in another table indefinitely. Rows flagged `sensitive` never store the
-- body at all when delivered on the first attempt, and have it cleared on
-- reaching a terminal state — which requires `html` to be nullable.
--
-- Rollback: see prisma/rollbacks/.

-- AlterTable
ALTER TABLE "email_outbox" ADD COLUMN     "sensitive" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "html" DROP NOT NULL;
