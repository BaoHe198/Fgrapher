import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { publicStudioAddress } from "@/lib/privacy/profile-privacy";
import { profileMapPoint } from "@/services/profile-area";

process.env.NEXTAUTH_SECRET ??= "test-secret-for-profile-area-0123456789";

// A real-looking address point in Ho Chi Minh City.
const home = { latitude: 10.776889, longitude: 106.700806 };

const metresBetween = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const north = (a.latitude - b.latitude) * 111_320;
  const east =
    (a.longitude - b.longitude) *
    111_320 *
    Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(north, east);
};

describe("địa chỉ studio trên trang công khai", () => {
  it("chỉ hiện khi là studio và studio đã tắt làm mờ vị trí", () => {
    assert.equal(
      publicStudioAddress({
        role: "STUDIO",
        address: " 25 Nguyễn Huệ ",
        hideExactLocation: false,
      }),
      "25 Nguyễn Huệ",
    );
  });

  it("studio còn để làm mờ vị trí (mặc định) thì địa chỉ vẫn riêng tư", () => {
    assert.equal(
      publicStudioAddress({
        role: "STUDIO",
        address: "25 Nguyễn Huệ",
        hideExactLocation: true,
      }),
      null,
    );
  });

  it("mọi vai trò khác không bao giờ lộ địa chỉ, dù đã tắt làm mờ", () => {
    for (const role of [
      "PHOTOGRAPHER",
      "VIDEOGRAPHER",
      "MAKEUP_ARTIST",
      "MODEL",
      "COSTUME_SHOP",
      "CAMERA_SHOP",
    ]) {
      assert.equal(
        publicStudioAddress({
          role,
          address: "25 Nguyễn Huệ",
          hideExactLocation: false,
        }),
        null,
        role,
      );
    }
  });

  it("studio chưa nhập địa chỉ thì không có gì để hiện", () => {
    assert.equal(
      publicStudioAddress({
        role: "STUDIO",
        address: "  ",
        hideExactLocation: false,
      }),
      null,
    );
  });
});

describe("điểm trên bản đồ thu nhỏ của hồ sơ", () => {
  it("studio đã chọn hiện vị trí thì được ghim đúng chỗ", () => {
    assert.deepEqual(
      profileMapPoint({
        id: "p1",
        role: "STUDIO",
        ...home,
        hideExactLocation: false,
      }),
      { ...home, exact: true },
    );
  });

  it("studio còn làm mờ vị trí thì chỉ là một khu vực, không có ghim", () => {
    const point = profileMapPoint({
      id: "p1",
      role: "STUDIO",
      ...home,
      hideExactLocation: true,
    });
    assert.ok(point);
    assert.equal(point.exact, false);
    assert.notDeepEqual(
      { latitude: point.latitude, longitude: point.longitude },
      home,
    );
  });

  it("vai trò khác không bao giờ được ghim, kể cả khi không làm mờ trên Bản đồ F", () => {
    for (const hideExactLocation of [true, false]) {
      const point = profileMapPoint({
        id: "p2",
        role: "PHOTOGRAPHER",
        ...home,
        hideExactLocation,
      });
      assert.ok(point);
      assert.equal(point.exact, false);
      // Rounded to two decimals: a grid of about a kilometre.
      assert.equal(point.latitude, Math.round(point.latitude * 100) / 100);
      assert.equal(point.longitude, Math.round(point.longitude * 100) / 100);
      // Still in the neighbourhood it stands for.
      assert.ok(metresBetween(point, home) < 1500);
    }
  });

  it("một điểm làm tròn không dẫn ngược về được địa chỉ: nhiều địa chỉ ra cùng một điểm", () => {
    const a = profileMapPoint({
      id: "p3",
      role: "MODEL",
      latitude: 10.7761,
      longitude: 106.7012,
      hideExactLocation: false,
    });
    const b = profileMapPoint({
      id: "p3",
      role: "MODEL",
      latitude: 10.7789,
      longitude: 106.7041,
      hideExactLocation: false,
    });
    assert.deepEqual(a, b);
  });

  it("hồ sơ chưa định vị được địa chỉ thì không có bản đồ", () => {
    assert.equal(
      profileMapPoint({
        id: "p4",
        role: "PHOTOGRAPHER",
        latitude: null,
        longitude: null,
        hideExactLocation: true,
      }),
      null,
    );
  });
});
