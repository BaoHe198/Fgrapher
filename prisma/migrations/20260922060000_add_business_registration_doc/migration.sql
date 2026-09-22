-- Business registration certificate for a household business or a company
-- (Luật TMĐT 122/2025). A freelance individual uploads nothing extra, so
-- both columns stay null for them. Purged on the same 90-day clock as the
-- ID documents — see purgeExpiredKycDocuments.
ALTER TABLE "user_roles"
  ADD COLUMN "verificationBusinessDocUrl" TEXT,
  ADD COLUMN "verificationBusinessDocPublicId" TEXT;
