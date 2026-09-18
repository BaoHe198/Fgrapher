import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatAdministrativeLocation } from "@/lib/location";

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
