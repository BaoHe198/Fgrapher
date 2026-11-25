import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SERVICE_HOLD_MINUTES,
  SERVICE_HOLDS,
  serviceHoldFor,
} from "../service-matrix";

describe("serviceHoldFor", () => {
  it("maps each stored length back to its own level", () => {
    for (const hold of SERVICE_HOLDS) {
      assert.equal(serviceHoldFor(SERVICE_HOLD_MINUTES[hold]), hold);
    }
  });

  it("rounds an older package up, never cutting its hold short", () => {
    assert.equal(serviceHoldFor(30), "HOUR");
    assert.equal(serviceHoldFor(90), "TWO_HOURS");
    assert.equal(serviceHoldFor(180), "HALF_DAY");
    assert.equal(serviceHoldFor(300), "FULL_DAY");
    assert.equal(serviceHoldFor(720), "FULL_DAY");
  });
});
