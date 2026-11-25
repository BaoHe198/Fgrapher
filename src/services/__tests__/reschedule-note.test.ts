import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRescheduleNote, rescheduleNote } from "@/lib/booking-window";

describe("an agreed reschedule in the booking's history", () => {
  const from = { date: "2026-12-05", startTime: "09:00" };
  const to = { date: "2026-12-06", startTime: "08:00" };

  it("reads back the two slots it was written with", () => {
    assert.deepEqual(parseRescheduleNote(rescheduleNote(from, to)), {
      from,
      to,
    });
  });

  it("is not mistaken for a person's own note on a status change", () => {
    assert.equal(parseRescheduleNote(null), null);
    assert.equal(parseRescheduleNote("Khách bận, xin đổi giờ"), null);
    assert.equal(
      parseRescheduleNote("RESCHEDULED tomorrow -> next week"),
      null,
    );
  });
});
