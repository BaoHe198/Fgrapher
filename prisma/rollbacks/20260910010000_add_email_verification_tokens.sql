-- Rollback for 20260910010000_add_email_verification_tokens.
--
-- DATA LOSS: drops every outstanding email-verification token. Users
-- holding an unclicked verification link will find it dead and have to
-- request a new one; already-verified accounts are unaffected, since
-- verification is recorded on users.emailVerified, not here.
--
-- Rolling this back means email verification stops working entirely, so
-- the application code must be rolled back to a build that does not
-- require it (see src/lib/auth.ts's credentials authorize()).

DROP TABLE IF EXISTS "email_verification_tokens";
