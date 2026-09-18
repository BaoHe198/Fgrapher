import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PROVINCE_REGISTRY } from "../../../prisma/data/provinces-registry";

describe("nationwide geography registry", () => {
  it("contains all 34 provinces and 3,321 post-merger wards", () => {
    assert.equal(PROVINCE_REGISTRY.length, 34);
    assert.equal(
      PROVINCE_REGISTRY.reduce(
        (total, province) => total + province.wards.length,
        0,
      ),
      3_321,
    );
  });

  it("keeps province and ward identifiers unique", () => {
    assert.equal(
      new Set(PROVINCE_REGISTRY.map(({ province }) => province.code)).size,
      PROVINCE_REGISTRY.length,
    );
    assert.equal(
      new Set(PROVINCE_REGISTRY.map(({ province }) => province.name)).size,
      PROVINCE_REGISTRY.length,
    );

    for (const province of PROVINCE_REGISTRY) {
      assert.equal(
        new Set(province.wards.map((ward) => ward.code)).size,
        province.wards.length,
      );
      assert.equal(
        new Set(province.wards.map((ward) => ward.name)).size,
        province.wards.length,
      );
    }
  });

  it("preserves the existing HCMC ward codes", () => {
    const hcmc = PROVINCE_REGISTRY.find(
      ({ province }) => province.code === "tp-ho-chi-minh",
    );

    assert.equal(hcmc?.wards.length, 168);
    assert.equal(
      hcmc?.wards.every((ward) => /^\d{3}$/.test(ward.code)),
      true,
    );
  });
});
