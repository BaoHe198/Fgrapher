import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { providerMaySeeContact } from "@/lib/privacy/booking-contact";

describe("nhà cung cấp xem số điện thoại và địa chỉ của khách", () => {
  it("chỉ sau khi đã chấp nhận: đã xác nhận, hoàn tất, khách không đến", () => {
    for (const status of ["CONFIRMED", "COMPLETED", "NO_SHOW"]) {
      assert.equal(providerMaySeeContact(status), true, status);
    }
  });

  it("yêu cầu đang chờ thì chưa được xem", () => {
    assert.equal(providerMaySeeContact("PENDING"), false);
  });

  it("đã từ chối hoặc để hết hạn thì không bao giờ được xem", () => {
    assert.equal(providerMaySeeContact("DECLINED"), false);
    assert.equal(providerMaySeeContact("EXPIRED"), false);
    // Whatever the caller claims about the history.
    assert.equal(providerMaySeeContact("DECLINED", true), false);
    assert.equal(providerMaySeeContact("EXPIRED", true), false);
  });

  it("lịch bị hủy: chỉ khi trước đó đã được xác nhận", () => {
    assert.equal(providerMaySeeContact("CANCELLED", true), true);
    assert.equal(providerMaySeeContact("CANCELLED", false), false);
  });

  it("danh sách không biết lịch sử thì coi như chưa từng xác nhận", () => {
    assert.equal(providerMaySeeContact("CANCELLED"), false);
  });

  it("trạng thái lạ thì không cho xem", () => {
    assert.equal(providerMaySeeContact("SOMETHING_NEW"), false);
  });
});
