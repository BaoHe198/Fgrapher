import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AVATAR_DELIVERY_WIDTH,
  AVATAR_DELIVERY_WIDTH_LARGE,
  buildAvatarUrl,
} from "@/lib/media/variants";

const ORIGINAL =
  "https://res.cloudinary.com/demo/image/upload/v1788165459/fgrapher/account/abc/avatar.png";

describe("địa chỉ tải ảnh đại diện", () => {
  it("ảnh gốc trên Cloudinary được thu nhỏ và đổi sang WebP", () => {
    assert.equal(
      buildAvatarUrl(ORIGINAL),
      `https://res.cloudinary.com/demo/image/upload/c_limit,w_${AVATAR_DELIVERY_WIDTH},f_webp,q_auto/v1788165459/fgrapher/account/abc/avatar.png`,
    );
  });

  it("chỗ hiện ảnh lớn xin bản rộng hơn", () => {
    assert.ok(
      buildAvatarUrl(ORIGINAL, AVATAR_DELIVERY_WIDTH_LARGE).includes(
        `/upload/c_limit,w_${AVATAR_DELIVERY_WIDTH_LARGE},f_webp,q_auto/v1788165459/`,
      ),
    );
  });

  it("địa chỉ không có số phiên bản vẫn được thu nhỏ", () => {
    assert.equal(
      buildAvatarUrl(
        "https://res.cloudinary.com/demo/image/upload/fgrapher/account/abc/avatar.jpg",
      ),
      `https://res.cloudinary.com/demo/image/upload/c_limit,w_${AVATAR_DELIVERY_WIDTH},f_webp,q_auto/fgrapher/account/abc/avatar.jpg`,
    );
  });

  it("địa chỉ đã có phép biến đổi thì giữ nguyên, không chồng thêm", () => {
    const transformed =
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,f_webp,q_auto/v1789642854/fgrapher/portfolio/x.jpg";
    assert.equal(buildAvatarUrl(transformed), transformed);
  });

  it("ảnh tài khoản Google, ảnh xem trước và địa chỉ lạ thì giữ nguyên", () => {
    for (const url of [
      "https://lh3.googleusercontent.com/a/ACg8ocK=s96-c",
      "blob:http://localhost:3000/3f1c7a52-0d8e-4c0b-9d0a-6c1b5a2e9f11",
      "data:image/png;base64,AAAA",
      "/images/placeholder-avatar.png",
      "https://res.cloudinary.com/demo/video/upload/v1/fgrapher/clip.mp4",
    ]) {
      assert.equal(buildAvatarUrl(url), url, url);
    }
  });
});
