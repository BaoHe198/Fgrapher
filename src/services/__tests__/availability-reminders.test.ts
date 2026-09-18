import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { vietnamDateKey, vietnamDateStart } from "@/lib/vietnam-date";

describe("availability reminder date key", () => {
  it("uses the Vietnam calendar day across the UTC boundary", () => {
    assert.equal(
      vietnamDateKey(new Date("2026-09-18T17:30:00.000Z")),
      "2026-09-19",
    );
  });

  it("creates the date-only lower bound used by blocked-date queries", () => {
    assert.equal(
      vietnamDateStart(new Date("2026-09-18T17:30:00.000Z")).toISOString(),
      "2026-09-19T00:00:00.000Z",
    );
  });
});
