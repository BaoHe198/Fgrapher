-- Gives every provider who has no weekly hours at all the default week:
-- every day, 08:00-20:00 Vietnam time (owner, 16/11/2026).
--
-- Why: nothing ever wrote weekly hours for a new provider. Until they opened
-- /dashboard/calendar and saved a week, they were never free on any day -
-- invisible on Bản đồ F and in the /browse date filter, and with no slot on
-- their own booking page - however the customer widened the area or the
-- hours. New providers now get the same week in code on their first profile
-- save (ensureDefaultWeeklyHours in services/resource-calendar.ts); this
-- backfills the ones who signed up before that.
--
-- Data only, no schema change. A provider with any rule already (active or
-- not) is left alone. Provider roles = PROVIDER_ROLES in lib/constants.
--
-- Rollback. Both statements below write fixed id prefixes nothing else
-- uses; a provider who later saved their week through the editor got new
-- cuid rows (replaceWeeklyRules deletes and recreates), so only untouched
-- defaults are removed, and a resource is only removed if nothing hangs
-- off it:
--
--   DELETE FROM "availability_rules" WHERE "id" LIKE 'default\_hours\_%';
--   DELETE FROM "bookable_resources" r
--   WHERE r."id" LIKE 'default\_res\_%'
--     AND NOT EXISTS (SELECT 1 FROM "availability_rules" a WHERE a."resourceId" = r."id")
--     AND NOT EXISTS (SELECT 1 FROM "availability_blocks" b WHERE b."resourceId" = r."id")
--     AND NOT EXISTS (SELECT 1 FROM "booking_allocations" ba WHERE ba."resourceId" = r."id");

-- 1. The calendar resource itself, for a provider profile that never got
--    one (it is otherwise created lazily on the first calendar read/write).
INSERT INTO "bookable_resources" ("id", "profileId", "type", "isActive", "createdAt")
SELECT 'default_res_' || p."id", p."id", 'PROVIDER_SELF', true, NOW()
FROM "profiles" p
WHERE p."role" IN ('PHOTOGRAPHER', 'VIDEOGRAPHER', 'MAKEUP_ARTIST', 'STUDIO', 'MODEL')
  AND NOT EXISTS (
    SELECT 1 FROM "bookable_resources" r
    WHERE r."profileId" = p."id" AND r."type" = 'PROVIDER_SELF' AND r."isActive" = true
  );

-- 2. The default week, on every active provider resource with no rule.
INSERT INTO "availability_rules"
  ("id", "resourceId", "dayOfWeek", "startTime", "endTime", "isActive", "createdAt", "updatedAt")
SELECT 'default_hours_' || r."id" || '_' || d."day", r."id", d."day", '08:00', '20:00', true, NOW(), NOW()
FROM "bookable_resources" r
JOIN "profiles" p ON p."id" = r."profileId"
CROSS JOIN generate_series(0, 6) AS d("day")
WHERE r."type" = 'PROVIDER_SELF'
  AND r."isActive" = true
  AND p."role" IN ('PHOTOGRAPHER', 'VIDEOGRAPHER', 'MAKEUP_ARTIST', 'STUDIO', 'MODEL')
  AND NOT EXISTS (
    SELECT 1 FROM "availability_rules" a WHERE a."resourceId" = r."id"
  );
