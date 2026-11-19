import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { bookingErrorKey } from "@/lib/errors/booking-messages";
import { movedWindow } from "@/lib/booking-window";

describe("where a booking lands when a new time is accepted", () => {
  it("keeps the session's length when the proposal names only a start", () => {
    // 09:00–11:00 moved to 14:00 used to read "14:00 – 11:00".
    const moved = movedWindow({
      date: "2026-12-01",
      startTime: "14:00",
      endTime: null,
      previousStart: "09:00",
      previousEnd: "11:00",
      fallbackMinutes: 60,
    });
    assert.equal(moved.endTime, "16:00");
    // 14:00 in Vietnam is 07:00 UTC.
    assert.equal(moved.startAt.toISOString(), "2026-12-01T07:00:00.000Z");
    assert.equal(moved.endAt.toISOString(), "2026-12-01T09:00:00.000Z");
  });

  it("uses the proposed end when there is one", () => {
    const moved = movedWindow({
      date: "2026-12-01",
      startTime: "14:00",
      endTime: "17:30",
      previousStart: "09:00",
      previousEnd: "11:00",
      fallbackMinutes: 60,
    });
    assert.equal(moved.endTime, "17:30");
    assert.equal(moved.endAt.getTime() - moved.startAt.getTime(), 210 * 60_000);
  });

  it("falls back to the package length for a booking with no usable end", () => {
    for (const previousEnd of [null, "09:00", "08:00"]) {
      const moved = movedWindow({
        date: "2026-12-01",
        startTime: "10:00",
        endTime: null,
        previousStart: "09:00",
        previousEnd,
        fallbackMinutes: 90,
      });
      assert.equal(moved.endTime, "11:30");
    }
  });

  it("never prints an end time past midnight, but holds the full length", () => {
    const moved = movedWindow({
      date: "2026-12-01",
      startTime: "23:00",
      endTime: null,
      previousStart: "09:00",
      previousEnd: "11:00",
      fallbackMinutes: 60,
    });
    assert.equal(moved.endTime, "23:59");
    assert.equal(moved.endAt.getTime() - moved.startAt.getTime(), 120 * 60_000);
  });
});

describe("booking rules that depend on the real time of day", () => {
  const bookings = readFileSync("src/services/bookings.ts", "utf8");
  const availability = readFileSync("src/services/availability.ts", "utf8");

  it("measures the notice window from the Vietnam instant, not from UTC", () => {
    // Both read the slot as if it were UTC, seven hours late, so "24 hours"
    // was 17 — and they agreed with each other, so nothing looked wrong.
    assert.match(
      bookings,
      /startAt\.getTime\(\) < Date\.now\(\) \+ MIN_NOTICE_HOURS/,
    );
    assert.doesNotMatch(bookings, /slotInstant < Date\.now\(\)/);
    assert.match(availability, /:00\.000Z`\) -\s*7 \* 3_600_000/);
  });

  it("moves a rescheduled booking and its hold in one transaction", () => {
    const respond = bookings.slice(
      bookings.indexOf("export async function respondToReschedule("),
    );
    assert.match(respond, /db\.\$transaction\(async \(tx\) =>/);
    assert.match(respond, /tx\.bookingAllocation\.updateMany/);
    assert.doesNotMatch(
      respond.slice(0, respond.indexOf("const proposer")),
      /db\.bookingAllocation\.updateMany/,
    );
  });

  it("has words for the errors that carry a number", () => {
    assert.equal(
      bookingErrorKey("Bookings need at least 24 hours notice"),
      "noticeTooShort",
    );
    assert.equal(
      bookingErrorKey(
        "You already have 5 pending requests — wait for a response before sending more",
      ),
      "tooManyPending",
    );
    assert.equal(
      bookingErrorKey("A CONFIRMED booking can't move to DECLINED"),
      "invalidTransition",
    );
    assert.equal(bookingErrorKey("Something nobody mapped"), null);
  });
});
