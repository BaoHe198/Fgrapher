import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { packagePhotoUrl } from "../media/package-photo";

const photo = {
  url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg",
  type: "IMAGE",
  moderationStatus: "APPROVED",
  deletedAt: null,
};

describe("ảnh minh họa của gói trên trang công khai", () => {
  it("dùng ảnh nhà cung cấp chọn khi ảnh đã được duyệt", () => {
    assert.equal(packagePhotoUrl(photo), photo.url);
  });

  it("không có ảnh nào được chọn thì trả về null để trang tự lấy ảnh", () => {
    assert.equal(packagePhotoUrl(null), null);
  });

  it("ảnh chưa duyệt, bị từ chối hoặc bị máy từ chối không ra công khai", () => {
    for (const moderationStatus of ["PENDING", "REJECTED", "AUTO_REJECTED"]) {
      assert.equal(packagePhotoUrl({ ...photo, moderationStatus }), null);
    }
  });

  it("ảnh đã xóa không ra công khai dù từng được duyệt", () => {
    assert.equal(packagePhotoUrl({ ...photo, deletedAt: new Date() }), null);
    assert.equal(
      packagePhotoUrl({ ...photo, deletedAt: "2026-11-26T00:00:00.000Z" }),
      null,
    );
  });

  it("video không được dùng làm ảnh minh họa", () => {
    assert.equal(packagePhotoUrl({ ...photo, type: "VIDEO" }), null);
  });
});
