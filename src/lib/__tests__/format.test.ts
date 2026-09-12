import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDate,
  formatDateLong,
  formatDurationHours,
  formatWeekdayShort,
} from "@/lib/format";

// A Sunday (13/09/2026) at 17:00 UTC. In Asia/Ho_Chi_Minh (UTC+7) that is
// already 00:00 on Monday 14/09 — the cases below rely on that, because the
// whole point of these formatters is that they pin the zone instead of
// trusting whatever the machine running the tests happens to use.
const SUNDAY_HCM = new Date("2026-09-13T03:00:00.000Z");
const SUNDAY_UTC_BUT_MONDAY_HCM = new Date("2026-09-13T17:00:00.000Z");

describe("formatDateLong", () => {
  it("reads weekday + dd/MM/yyyy", () => {
    assert.equal(formatDateLong(SUNDAY_HCM), "Chủ Nhật, 13/09/2026");
  });

  it("keeps the year — this is the booking confirmation screen", () => {
    // The old long form ("Chủ Nhật, 13 tháng 9") dropped it, which is the one
    // place a missing year actually costs someone money.
    assert.match(formatDateLong(SUNDAY_HCM), /2026$/);
  });

  it("uses the same numeric date as formatDate, not its own spelling", () => {
    assert.ok(formatDateLong(SUNDAY_HCM).endsWith(formatDate(SUNDAY_HCM)));
  });

  it("resolves the weekday in Asia/Ho_Chi_Minh, not the runtime zone", () => {
    assert.match(formatDateLong(SUNDAY_UTC_BUT_MONDAY_HCM), /^Thứ Hai, 14\/09/);
  });

  it("accepts the ISO strings that come back from JSON responses", () => {
    assert.equal(
      formatDateLong(SUNDAY_HCM.toISOString()),
      "Chủ Nhật, 13/09/2026",
    );
  });
});

describe("formatWeekdayShort", () => {
  it("gives every weekday a short, space-free label", () => {
    // "Thứ 2" (what vi-VN's own short form returns) wraps in a ~30px calendar
    // cell; these never can.
    const labels = Array.from({ length: 7 }, (_, i) =>
      formatWeekdayShort(new Date(`2026-09-${13 + i}T03:00:00.000Z`)),
    );
    assert.deepEqual(labels, ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]);
    for (const label of labels) assert.doesNotMatch(label, /\s/);
  });
});

describe("formatDurationHours", () => {
  it("turns stored minutes into the hours users read", () => {
    assert.equal(formatDurationHours(120), "2");
    assert.equal(formatDurationHours(90), "1,5");
    assert.equal(formatDurationHours(30), "0,5");
  });

  it("never shows a trailing ,0 on a whole number of hours", () => {
    assert.equal(formatDurationHours(60), "1");
  });
});
