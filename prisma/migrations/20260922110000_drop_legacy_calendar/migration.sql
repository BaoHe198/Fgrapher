-- Contract step of the provider-architecture migration: drop the
-- userId-keyed calendar tables now that everything reads and writes
-- BookableResource-keyed ones. Confirmed in writing by the project owner,
-- 22/09/2026.
--
-- The copy below is NOT redundant with
-- scripts/backfill-provider-architecture.ts. That script has run on dev;
-- production has not run it, and it cannot run after this migration because
-- the tables it reads are gone. So the data move lives here, where
-- `migrate deploy` performs it in the same transaction that drops the
-- source — either both happen or neither does.

-- Every provider profile needs a resource before its calendar can be
-- attached. Idempotent: only profiles with none get one.
INSERT INTO "bookable_resources" ("id", "profileId", "type", "isActive", "createdAt")
SELECT gen_random_uuid()::text, p."id", 'PROVIDER_SELF', true, now()
FROM "profiles" p
WHERE p."role" IN ('PHOTOGRAPHER','VIDEOGRAPHER','MAKEUP_ARTIST','STUDIO','MODEL')
  AND NOT EXISTS (
    SELECT 1 FROM "bookable_resources" r WHERE r."profileId" = p."id"
  );

-- Weekly hours. Keyed on userId before, so the join goes through the
-- profile. A row whose owner has no provider profile (a customer who once
-- set hours, a shop) has no resource to move to and is dropped with the
-- table — that is the same 7 rows the dry run reported as orphans.
INSERT INTO "availability_rules" ("id", "resourceId", "dayOfWeek", "startTime", "endTime", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."id", a."dayOfWeek", a."startTime", a."endTime", a."isActive", now(), now()
FROM "availabilities" a
JOIN "profiles" p ON p."userId" = a."userId"
JOIN "bookable_resources" r ON r."profileId" = p."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "availability_rules" ar
  WHERE ar."resourceId" = r."id"
    AND ar."dayOfWeek" = a."dayOfWeek"
    AND ar."startTime" = a."startTime"
    AND ar."endTime" = a."endTime"
);

-- Manual blocks. A date plus "HH:mm" in Vietnam local time becomes a real
-- instant; Vietnam is UTC+7 with no daylight saving, hence the fixed offset.
-- Null times meant "the whole day", which becomes 00:00-23:59 local.
INSERT INTO "availability_blocks" ("id", "resourceId", "startAt", "endAt", "reason", "createdAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  (b."date"::timestamp + COALESCE(b."startTime", '00:00')::time - interval '7 hours') AT TIME ZONE 'UTC',
  (b."date"::timestamp + COALESCE(b."endTime", '23:59')::time - interval '7 hours') AT TIME ZONE 'UTC',
  b."reason",
  now()
FROM "blocked_dates" b
JOIN "profiles" p ON p."userId" = b."userId"
JOIN "bookable_resources" r ON r."profileId" = p."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "availability_blocks" ab
  WHERE ab."resourceId" = r."id"
    AND ab."startAt" = ((b."date"::timestamp + COALESCE(b."startTime", '00:00')::time - interval '7 hours') AT TIME ZONE 'UTC')
);

DROP TABLE "availabilities";
DROP TABLE "blocked_dates";
