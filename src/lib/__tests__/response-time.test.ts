import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { medianMinutes, responseBucket } from "@/lib/response-time";

describe("medianMinutes", () => {
  it("needs at least three answered requests", () => {
    assert.equal(medianMinutes([10, 20]), null);
    assert.equal(medianMinutes([10, 20, 90]), 20);
  });

  it("averages the middle pair for an even count", () => {
    assert.equal(medianMinutes([10, 20, 40, 1000]), 30);
  });
});

describe("responseBucket", () => {
  it("rounds up to a promise the provider keeps", () => {
    assert.deepEqual(responseBucket(50), { unit: "hour", value: 1 });
    assert.deepEqual(responseBucket(130), { unit: "hours", value: 3 });
    assert.deepEqual(responseBucket(24 * 60), { unit: "day", value: 1 });
    assert.deepEqual(responseBucket(30 * 60), { unit: "days", value: 2 });
  });
});
