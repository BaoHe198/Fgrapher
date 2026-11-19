import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchProvince, matchWard } from "@/lib/vietnam/area-match";

const provinces = [
  { id: "hcm", name: "Thành phố Hồ Chí Minh" },
  { id: "kh", name: "Tỉnh Khánh Hòa" },
  { id: "hn", name: "Thành phố Hà Nội" },
];

const wards = [
  { id: "vt", name: "Phường Vũng Tàu" },
  { id: "sg", name: "Phường Sài Gòn" },
  { id: "ap-p", name: "Phường An Phú" },
  { id: "ap-x", name: "Xã An Phú" },
  { id: "cd", name: "Đặc khu Côn Đảo" },
];

describe("matchProvince", () => {
  it("matches the full name", () => {
    assert.equal(matchProvince("Thành phố Hồ Chí Minh", provinces)?.id, "hcm");
  });

  it("matches a name the geocoder gave without its prefix", () => {
    assert.equal(matchProvince("Khánh Hòa", provinces)?.id, "kh");
  });

  it("ignores accents, case and old-style tone placement", () => {
    assert.equal(matchProvince("khánh hoà", provinces)?.id, "kh");
    assert.equal(matchProvince("TP. Ho Chi Minh", provinces)?.id, "hcm");
  });

  it("returns null for an unknown or missing name", () => {
    assert.equal(matchProvince("Tỉnh Bà Rịa", provinces), null);
    assert.equal(matchProvince(undefined, provinces), null);
    assert.equal(matchProvince("  ", provinces), null);
  });
});

describe("matchWard", () => {
  it("matches with and without the prefix", () => {
    assert.equal(matchWard("Phường Vũng Tàu", wards)?.id, "vt");
    assert.equal(matchWard("Sài Gòn", wards)?.id, "sg");
    assert.equal(matchWard("Côn Đảo", wards)?.id, "cd");
  });

  it("uses the prefix to tell two same-named wards apart", () => {
    assert.equal(matchWard("Phường An Phú", wards)?.id, "ap-p");
    assert.equal(matchWard("Xã An Phú", wards)?.id, "ap-x");
  });

  it("refuses to guess between two same-named wards", () => {
    assert.equal(matchWard("An Phú", wards), null);
  });
});
