import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { provinceMatch } from "@/services/search";
import {
  profileProvinceIds,
  providerCoversProvince,
  type ProfileServiceAreaSource,
} from "@/services/service-areas";

// QA-03 (22/09/2026): photographer@test.com had a VERIFIED photographer
// role, a published profile based in TP.HCM, and showed up correctly on
// Fmap in TP.HCM. /dashboard/opportunities was empty — while two open
// PHOTOGRAPHER requests sat in TP.HCM.
//
// Nothing was wrong with the role or verification gates. The two surfaces
// simply asked different questions: /browse and Fmap asked provinceMatch(),
// which considers Profile.provinceId; the opportunity feed asked
// ProfileServiceArea alone, and no code had ever written a row into it.
// These tests hold the two answers together.

const HCMC = "province-hcmc";
const DA_NANG = "province-da-nang";

function profile(
  overrides: Partial<ProfileServiceAreaSource> = {},
): ProfileServiceAreaSource {
  return {
    provinceId: null,
    servesNationwide: false,
    serviceAreas: [],
    user: { ward: null },
    ...overrides,
  };
}

describe("profileProvinceIds", () => {
  it("matches a provider on their profile's own province alone", () => {
    // The exact shape of every provider on the dev database, and of anyone
    // who finishes onboarding without opening "Khu vực phục vụ".
    assert.deepEqual(profileProvinceIds(profile({ provinceId: HCMC })), [HCMC]);
  });

  it("includes the extra provinces a provider opted into", () => {
    const ids = profileProvinceIds(
      profile({ provinceId: HCMC, serviceAreas: [{ provinceId: DA_NANG }] }),
    );
    assert.deepEqual([...ids].sort(), [DA_NANG, HCMC].sort());
  });

  it("does not repeat a province listed both ways", () => {
    const ids = profileProvinceIds(
      profile({ provinceId: HCMC, serviceAreas: [{ provinceId: HCMC }] }),
    );
    assert.deepEqual(ids, [HCMC]);
  });

  it("falls back to the owner's personal ward when the profile has none", () => {
    const ids = profileProvinceIds(
      profile({ user: { ward: { provinceId: HCMC } } }),
    );
    assert.deepEqual(ids, [HCMC]);
  });

  it("never lets the home ward override a province the profile chose", () => {
    // Living in TP.HCM while listing this profile under Đà Nẵng means
    // Đà Nẵng. Same rule provinceMatch() follows.
    const ids = profileProvinceIds(
      profile({ provinceId: DA_NANG, user: { ward: { provinceId: HCMC } } }),
    );
    assert.deepEqual(ids, [DA_NANG]);
  });

  it("returns nothing — not everything — when there is no location at all", () => {
    // An empty list must read as "match nowhere". Treating it as "match
    // everywhere" would push nationwide request notifications at a provider
    // who never said where they work. `servesNationwide` is the explicit,
    // separate way to say that.
    assert.deepEqual(profileProvinceIds(profile()), []);
  });

  it("is not itself the nationwide switch", () => {
    assert.deepEqual(
      profileProvinceIds(profile({ servesNationwide: true })),
      [],
    );
  });
});

describe("providerCoversProvince", () => {
  const branches = (providerCoversProvince(HCMC).OR ?? []) as Record<
    string,
    unknown
  >[];

  it("is provinceMatch plus nationwide, so the two cannot drift apart", () => {
    // Built from provinceMatch() rather than duplicated beside it. If that
    // ever stops being true, this fails — which is how QA-03 happened in
    // the first place.
    const search = (provinceMatch(HCMC).OR ?? []) as Record<string, unknown>[];
    assert.deepEqual(branches.slice(1), search);
  });

  it("includes providers who take work anywhere in the country", () => {
    assert.deepEqual(branches[0], { servesNationwide: true });
  });

  it("includes a provider whose profile province is the one asked for", () => {
    assert.ok(branches.some((b) => b.provinceId === HCMC));
  });

  it("includes a provider who listed the province as a service area", () => {
    assert.ok(
      branches.some(
        (b) =>
          JSON.stringify(b.serviceAreas) ===
          JSON.stringify({ some: { provinceId: HCMC } }),
      ),
    );
  });
});

// Widening WHERE a provider matches must not widen WHO matches. These pin
// the gates that were never the problem and must survive the fix — same
// source-reading approach as request-offer-ownership.test.ts, since the
// conditions live inside a Prisma query rather than in a pure function.
describe("cổng vai trò và xác minh danh tính của feed cơ hội", () => {
  const source = readFileSync(
    path.join(
      path.resolve(__dirname, "../../.."),
      "src/services/request-offers.ts",
    ),
    "utf8",
  );
  const feed = source.slice(
    source.indexOf("export async function listOpportunitiesForProvider"),
    source.indexOf("export async function getOpportunityDetail"),
  );

  it("chỉ nhận role đang hoạt động và đã xác minh danh tính", () => {
    assert.match(feed, /!userRole\?\.active/);
    assert.match(feed, /verificationStatus !== "VERIFIED"/);
  });

  it("vẫn loại yêu cầu do chính provider đăng", () => {
    assert.match(feed, /customerId:\s*{\s*not:\s*userId\s*}/);
  });

  it("chỉ lấy yêu cầu đúng vai trò, đã đăng và đang mở", () => {
    assert.match(feed, /role,/);
    assert.match(feed, /isDraft:\s*false/);
    assert.match(feed, /status:\s*{\s*in:\s*\["OPEN",\s*"HAS_OFFERS"\]\s*}/);
  });

  it("không coi 'không có khu vực nào' là 'toàn quốc'", () => {
    // provinceIds: { in: [] } matches nothing, which is the safe reading.
    // The nationwide case is the explicit servesNationwide branch.
    assert.match(
      feed,
      /profile\.servesNationwide \? \{\} : \{ provinceId: \{ in: provinceIds \} \}/,
    );
  });
});
