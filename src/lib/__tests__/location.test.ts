import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatAdministrativeLocation,
  formatFullAddress,
} from "@/lib/location";

describe("formatAdministrativeLocation", () => {
  it("shows only ward and province", () => {
    assert.equal(
      formatAdministrativeLocation({
        ward: { name: "Phường Bến Thành" },
        province: { name: "Thành phố Hồ Chí Minh" },
      }),
      "Phường Bến Thành, Thành phố Hồ Chí Minh",
    );
  });

  it("falls back to the account ward for a legacy profile", () => {
    assert.equal(
      formatAdministrativeLocation(
        {},
        {
          ward: {
            name: "Phường Hải Châu",
            province: { name: "Thành phố Đà Nẵng" },
          },
        },
      ),
      "Phường Hải Châu, Thành phố Đà Nẵng",
    );
  });

  it("never receives or renders a detailed address field", () => {
    const location = formatAdministrativeLocation({
      ward: { name: "Phường Sài Gòn" },
      province: { name: "Thành phố Hồ Chí Minh" },
      address: "123 Nguyễn Huệ",
    } as Parameters<typeof formatAdministrativeLocation>[0]);
    assert.equal(location, "Phường Sài Gòn, Thành phố Hồ Chí Minh");
    assert.doesNotMatch(location, /Nguyễn Huệ/);
  });
});

describe("formatFullAddress", () => {
  const ward = { name: "Phường Tân Bình" };
  const province = { name: "Thành phố Hồ Chí Minh" };

  it("appends ward and province to a street address", () => {
    assert.equal(
      formatFullAddress("12 Cộng Hòa", ward, province),
      "12 Cộng Hòa, Phường Tân Bình, Thành phố Hồ Chí Minh",
    );
  });

  it("does not repeat what the address already says", () => {
    assert.equal(
      formatFullAddress(
        "Phường Tân Bình, Thành phố Hồ Chí Minh",
        ward,
        province,
      ),
      "Phường Tân Bình, Thành phố Hồ Chí Minh",
    );
  });

  it("works without a street address", () => {
    assert.equal(
      formatFullAddress(null, ward, province),
      "Phường Tân Bình, Thành phố Hồ Chí Minh",
    );
  });
});
