-- Rollback for 20260910005958_add_email_outbox.
--
-- DATA LOSS: drops the entire email outbox. Any email queued but not yet
-- delivered is discarded and will never be sent. Check first:
--   SELECT status, count(*) FROM email_outbox GROUP BY status;
-- and only proceed once nothing is left in PENDING/SENDING.
--
-- Run 20260910120000_email_outbox_locking_and_token_hashing's rollback
-- before this one if that migration has also been applied.

DROP TABLE IF EXISTS "email_outbox";

DROP TYPE IF EXISTS "EmailOutboxStatus";
