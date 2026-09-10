-- Rollback for 20260910130100_scrub_sensitive_email_bodies.
--
-- DATA LOSS: deletes any outbox row whose body has already been scrubbed,
-- because the old schema requires html to be NOT NULL and the body cannot
-- be reconstructed. Those rows are terminal (SENT or FAILED) ledger
-- entries, so nothing undelivered is lost — but the record of them is.
-- Check the count first:
--   SELECT count(*) FROM "email_outbox" WHERE "html" IS NULL;

DELETE FROM "email_outbox" WHERE "html" IS NULL;

ALTER TABLE "email_outbox"
  DROP COLUMN IF EXISTS "sensitive",
  ALTER COLUMN "html" SET NOT NULL;
