-- Makes the invariant ProfileServiceArea.isPrimary has always claimed
-- actually true: "isPrimary duplicates Profile.provinceId as a
-- ProfileServiceArea row … so 'which provinces does this profile show up in'
-- is always a single query over this table" (schema.prisma). No code ever
-- wrote such a row, so every existing provider has a province on their
-- profile and an empty service-area list.
--
-- The cost of that gap (QA-03, 22/09/2026): /browse and Fmap place a
-- provider by Profile.provinceId, while the "Yêu cầu phù hợp" feed and the
-- new-request broadcast read ProfileServiceArea only. A verified
-- photographer in TP.HCM was on the map in TP.HCM and matched to none of
-- the open TP.HCM requests for their own role.
--
-- Data only, no schema change. Existing rows are kept: a province the
-- provider added by hand that happens to be their own is simply flagged as
-- the primary one, which is what it is.
--
-- Rollback (nothing else in the codebase writes isPrimary = true on this
-- table, so this deletes exactly what the statement below inserted, and
-- leaves every province a provider chose for themselves alone):
--
--   DELETE FROM "profile_service_areas" WHERE "isPrimary" = true;
INSERT INTO "profile_service_areas" ("profileId", "provinceId", "isPrimary", "createdAt")
SELECT "id", "provinceId", true, NOW()
FROM "profiles"
WHERE "provinceId" IS NOT NULL
ON CONFLICT ("profileId", "provinceId")
DO UPDATE SET "isPrimary" = true;
