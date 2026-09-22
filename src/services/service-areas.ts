import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { provinceMatch } from "@/services/search";

/**
 * Where a provider profile can be matched — the one answer the whole app
 * should be using.
 *
 * There were two answers before (QA-03, 22/09/2026). /browse and Fmap asked
 * services/search.ts's provinceMatch(), which considers the profile's own
 * province, its extra service areas, and the owner's personal ward as a last
 * resort. The opportunity feed and the new-request broadcast asked
 * ProfileServiceArea alone. Every seeded provider has a province on their
 * profile and no service-area rows at all, so a verified photographer in
 * TP.HCM appeared on the map in TP.HCM and was told there were no matching
 * requests in TP.HCM — two open ones, same role, same province.
 *
 * ProfileServiceArea.isPrimary exists precisely to stop those drifting
 * apart: the schema comment says a true row "duplicates Profile.provinceId
 * … so 'which provinces does this profile show up in' is always a single
 * query". Nothing ever wrote one. syncPrimaryServiceArea() below now does,
 * and this resolver treats Profile.provinceId as authoritative anyway, so a
 * row that goes missing can never hide a provider again.
 */
export const SERVICE_AREA_SELECT = {
  provinceId: true,
  servesNationwide: true,
  serviceAreas: { select: { provinceId: true } },
  user: { select: { ward: { select: { provinceId: true } } } },
} satisfies Prisma.ProfileSelect;

export interface ProfileServiceAreaSource {
  provinceId: string | null;
  servesNationwide: boolean;
  serviceAreas: { provinceId: string }[];
  user: { ward: { provinceId: string } | null };
}

/**
 * Every province this profile should be matched in, deduplicated.
 *
 * Deliberately identical in meaning to provinceMatch()'s three branches:
 *  - the extra provinces the provider opted into,
 *  - the province their profile is based in,
 *  - and, only when the profile has none of its own, the province of the
 *    owner's personal ward. A provider who lives in TP.HCM but listed this
 *    profile under Đà Nẵng meant Đà Nẵng; their home address must not drag
 *    them back.
 *
 * Empty means "nowhere to match" — never "everywhere". Nationwide is a
 * separate, explicit flag; callers must check `servesNationwide` first.
 */
export function profileProvinceIds(
  profile: ProfileServiceAreaSource,
): string[] {
  const ids = new Set(profile.serviceAreas.map((area) => area.provinceId));
  if (profile.provinceId) ids.add(profile.provinceId);
  else if (profile.user.ward) ids.add(profile.user.ward.provinceId);
  return [...ids];
}

/**
 * Keeps the ProfileServiceArea row that mirrors Profile.provinceId correct
 * after the profile's own location is saved.
 *
 * Called on every profile save rather than only on a change: it is two cheap
 * statements against a tiny table, and the alternative — comparing against
 * the previous value — silently does nothing for the rows that are already
 * wrong, which is exactly the state this bug left the database in.
 */
export async function syncPrimaryServiceArea(
  profileId: string,
  provinceId: string | null,
): Promise<void> {
  await db.$transaction([
    // A primary row for a province the profile no longer claims. Extra
    // areas the provider chose themselves are never isPrimary, so this
    // cannot delete one of those.
    //
    // One deliberate wrinkle: if a provider had ALSO listed their home
    // province by hand, that row carries isPrimary too (the service-areas
    // route flags it), so moving their address drops it. The alternative —
    // demoting it instead of deleting — means every correction to an
    // address permanently widens where that provider gets matched, which is
    // the worse failure. They can re-add the old province in one click.
    db.profileServiceArea.deleteMany({
      where: {
        profileId,
        isPrimary: true,
        ...(provinceId ? { provinceId: { not: provinceId } } : {}),
      },
    }),
    ...(provinceId
      ? [
          db.profileServiceArea.upsert({
            where: { profileId_provinceId: { profileId, provinceId } },
            create: { profileId, provinceId, isPrimary: true },
            update: { isPrimary: true },
          }),
        ]
      : []),
  ]);
}

/**
 * "This profile can take work in this province" as a Prisma filter, for the
 * queries that select providers rather than read one profile.
 *
 * Built ON TOP of provinceMatch() rather than beside it, so the opportunity
 * broadcast and /browse cannot drift apart again — that drift is QA-03. The
 * one thing added here is servesNationwide, which /browse handles separately
 * (it lists nationwide providers in their own section) but a match either
 * includes or does not.
 */
export function providerCoversProvince(
  provinceId: string,
): Prisma.ProfileWhereInput {
  return {
    OR: [{ servesNationwide: true }, ...(provinceMatch(provinceId).OR ?? [])],
  };
}
