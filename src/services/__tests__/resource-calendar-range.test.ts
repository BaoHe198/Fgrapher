import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  localDayAndTimeToInstant,
  localDayRange,
} from "@/services/resource-calendar";

describe("localDayRange", () => {
  it("covers a whole-day block stored from Vietnamese midnight", () => {
    const day = new Date("2026-10-13T00:00:00.000Z");
    const next = new Date("2026-10-14T00:00:00.000Z");
    const { start, end } = localDayRange(day, next);

    // How upsertBlock stores a whole-day block on 13/10.
    const blockStart = localDayAndTimeToInstant(day, "00:00");
    assert.equal(blockStart.toISOString(), "2026-10-12T17:00:00.000Z");

    assert.ok(blockStart >= start, "the block starts inside the range");
    assert.ok(blockStart < end);
  });

  it("does not reach into the next Vietnamese day", () => {
    const day = new Date("2026-10-13T00:00:00.000Z");
    const next = new Date("2026-10-14T00:00:00.000Z");
    const { end } = localDayRange(day, next);
    const nextDayBlock = localDayAndTimeToInstant(next, "00:00");
    assert.ok(!(nextDayBlock < end), "14/10's block is outside 13/10's range");
  });
});
