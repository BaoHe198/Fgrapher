import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { provinceMatch } from "@/services/search";

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
