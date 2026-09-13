import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { provinceMatch, wardMatch } from "@/services/search";

// Guards the /browse province filter against drifting away from how
// services/bookings.ts decides where a provider is. The bug this pins down:
// a card showing "Thành phố Hồ Chí Minh" (read from the owner's personal
// ward) disappeared the moment the list was filtered by Hồ Chí Minh,
// because the filter only looked at the profile's own province, which that
// provider had never set.

const HCMC = "province-hcmc";

describe("provinceMatch", () => {
  const branches = (provinceMatch(HCMC).OR ?? []) as Record<string, unknown>[];

  it("matches a profile whose own province is the one searched", () => {
    assert.ok(branches.some((b) => b.provinceId === HCMC));
  });

  it("matches a profile that serves the province as a service area", () => {
    assert.ok(
      branches.some(
        (b) =>
          JSON.stringify(b.serviceAreas) ===
          JSON.stringify({ some: { provinceId: HCMC } }),
      ),
    );
  });

  it("falls back to the owner's personal ward when the profile has no province", () => {
    const fallback = branches.find((b) => "user" in b);
    assert.ok(fallback, "no owner-ward fallback branch");
    assert.deepEqual(fallback.user, { ward: { provinceId: HCMC } });
  });

  it("never lets the home ward override a province the profile chose", () => {
    // A provider living in Hồ Chí Minh who listed their profile under
    // Đà Nẵng meant Đà Nẵng. The fallback must only fire for profiles with
    // no province at all — without this guard their home address would
    // drag them back into Hồ Chí Minh results.
    const fallback = branches.find((b) => "user" in b);
    assert.equal(fallback?.provinceId, null);
  });
});

describe("wardMatch", () => {
  // The bug this pins down: filtering by Phường An Đông returned a provider
  // whose card reads Phường Bến Thành. Their profile had no ward, and the
  // old filter treated "no ward on the profile" as "matches every ward",
  // ignoring that their personal account said exactly where they are.
  const AN_DONG = "ward-an-dong";
  const branches = (wardMatch(AN_DONG).OR ?? []) as Record<string, unknown>[];

  it("matches a profile whose own ward is the one searched", () => {
    assert.ok(branches.some((b) => b.wardId === AN_DONG && !("user" in b)));
  });

  it("falls back to the owner's ward only when the profile has none", () => {
    const fallback = branches.find(
      (b) =>
        b.wardId === null &&
        JSON.stringify(b.user) === JSON.stringify({ wardId: AN_DONG }),
    );
    assert.ok(
      fallback,
      "no owner-ward fallback guarded by profile wardId: null",
    );
  });

  it("no longer lets a profile with no ward match every ward unconditionally", () => {
    // The regression itself: a bare `{ wardId: null }` branch. Every
    // null-ward branch must now also say something about the owner's ward.
    const bare = branches.filter((b) => b.wardId === null && !("user" in b));
    assert.equal(bare.length, 0, "a bare { wardId: null } branch is back");
  });

  it("still includes providers whose location is genuinely unknown", () => {
    // Deliberate, kept from the original design: providers who roam a
    // whole city often set no ward anywhere, and excluding them from every
    // ward search produced false negatives. Their card has no ward on it
    // to contradict the filter.
    assert.ok(
      branches.some(
        (b) =>
          b.wardId === null &&
          JSON.stringify(b.user) === JSON.stringify({ wardId: null }),
      ),
    );
  });
});
