import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isGoldenHourSlot,
  minutesToTime,
  sunTimes,
  timeToMinutes,
} from "@/lib/sun";

// Reference values: timeanddate.com for Ho Chi Minh City (10.78, 106.70)
// and Hà Nội (21.03, 105.85). Asserted within 4 minutes - the simplified
// equations are good to about one.
function near(actual: number, expected: string) {
  const diff = Math.abs(actual - timeToMinutes(expected));
  assert.ok(diff <= 4, `${minutesToTime(actual)} vs ${expected}`);
}

describe("sunTimes", () => {
  it("matches Ho Chi Minh City in June", () => {
    const sun = sunTimes("2026-06-21", 10.78, 106.7);
    assert.ok(sun);
    near(sun.sunrise, "05:31");
    near(sun.sunset, "18:14");
  });

  it("matches Ho Chi Minh City in December", () => {
    const sun = sunTimes("2026-12-21", 10.78, 106.7);
    assert.ok(sun);
    near(sun.sunrise, "06:08");
    near(sun.sunset, "17:35");
  });

  it("matches Hà Nội in June, where the day is longer", () => {
    const sun = sunTimes("2026-06-21", 21.03, 105.85);
    assert.ok(sun);
    near(sun.sunrise, "05:13");
    near(sun.sunset, "18:42");
  });

  it("rejects a malformed date", () => {
    assert.equal(sunTimes("not-a-date", 10.78, 106.7), null);
  });
});

describe("isGoldenHourSlot", () => {
  const sun = {
    sunrise: timeToMinutes("05:40"),
    sunset: timeToMinutes("18:00"),
  };

  it("marks slots around sunrise and before sunset", () => {
    assert.equal(isGoldenHourSlot("05:00", sun), false);
    assert.equal(isGoldenHourSlot("05:30", sun), true);
    assert.equal(isGoldenHourSlot("06:00", sun), true);
    assert.equal(isGoldenHourSlot("07:00", sun), false);
    assert.equal(isGoldenHourSlot("16:00", sun), false);
    assert.equal(isGoldenHourSlot("16:30", sun), true);
    assert.equal(isGoldenHourSlot("17:30", sun), true);
    assert.equal(isGoldenHourSlot("18:30", sun), false);
  });
});
