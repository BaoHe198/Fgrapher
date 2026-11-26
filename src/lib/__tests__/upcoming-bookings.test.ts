import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { upcomingBookingFilter } from "../booking-window";

describe("một định nghĩa cho “lịch sắp tới”", () => {
  it("chỉ tính lịch đã xác nhận", () => {
    assert.equal(
      upcomingBookingFilter(new Date("2026-11-26T03:00:00.000Z")).status,
      "CONFIRMED",
    );
  });

  it("tính theo giờ bắt đầu: lịch chiều nay vẫn là sắp tới, lịch sáng nay thì không", () => {
    const now = new Date("2026-11-26T03:00:00.000Z"); // 10:00 giờ Việt Nam
    const [byStart] = upcomingBookingFilter(now).OR;
    assert.deepEqual(byStart, { startAt: { gte: now } });
  });

  it("lịch cũ chưa có giờ bắt đầu thì tính theo ngày ở Việt Nam", () => {
    // 23:30 ngày 26/11 theo giờ UTC đã là 06:30 ngày 27/11 ở Việt Nam.
    const lateUtc = new Date("2026-11-26T23:30:00.000Z");
    const [, byDay] = upcomingBookingFilter(lateUtc).OR;
    assert.deepEqual(byDay, {
      startAt: null,
      date: { gte: new Date("2026-11-27") },
    });
    // 16:59 UTC vẫn là 23:59 ngày 26/11 ở Việt Nam.
    const sameDay = new Date("2026-11-26T16:59:00.000Z");
    const [, sameDayFilter] = upcomingBookingFilter(sameDay).OR;
    assert.deepEqual(sameDayFilter, {
      startAt: null,
      date: { gte: new Date("2026-11-26") },
    });
  });
});
