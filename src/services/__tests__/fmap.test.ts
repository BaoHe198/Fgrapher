import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fmapSearchSchema } from "@/lib/validations/fmap";
import {
  isProviderAvailableForInterval,
  obfuscateCoordinates,
  paddedBounds,
} from "@/services/fmap";

const baseSearch = {
  north: 10.9,
  south: 10.7,
  east: 106.8,
  west: 106.6,
  date: "2099-09-20",
  start: "09:00",
  end: "11:00",
  roles: ["PHOTOGRAPHER"] as const,
  categories: [],
};

describe("Fmap query validation", () => {
  it("accepts a bounded viewport and a valid interval", () => {
    assert.equal(fmapSearchSchema.safeParse(baseSearch).success, true);
  });

  it("rejects invalid dates, reversed times and country-sized queries", () => {
    assert.equal(
      fmapSearchSchema.safeParse({ ...baseSearch, date: "2099-02-30" }).success,
      false,
    );
    assert.equal(
      fmapSearchSchema.safeParse({
        ...baseSearch,
        start: "12:00",
        end: "10:00",
      }).success,
      false,
    );
    assert.equal(
      fmapSearchSchema.safeParse({ ...baseSearch, north: 23, south: 8 })
        .success,
      false,
    );
  });
});

describe("Fmap availability", () => {
  const available = {
    date: "2099-09-20",
    start: "09:00",
    end: "11:00",
    weeklyWindows: [{ startTime: "08:00", endTime: "17:00" }],
    bookings: [],
    now: new Date("2099-09-18T00:00:00.000Z"),
  };

  it("accepts an interval contained in a weekly window", () => {
    assert.equal(isProviderAvailableForInterval(available), true);
  });

  it("rejects whole-day and partially overlapping blocks", () => {
    assert.equal(
      isProviderAvailableForInterval({
        ...available,
        blockedDate: { startTime: null, endTime: null },
      }),
      false,
    );
    assert.equal(
      isProviderAvailableForInterval({
        ...available,
        blockedDate: { startTime: "10:30", endTime: "12:00" },
      }),
      false,
    );
  });

  it("uses an explicit booking end time before the service fallback", () => {
    assert.equal(
      isProviderAvailableForInterval({
        ...available,
        bookings: [
          {
            startTime: "08:00",
            endTime: "09:30",
            service: { duration: 30 },
          },
        ],
      }),
      false,
    );
  });

  it("rejects searches inside the minimum-notice window", () => {
    assert.equal(
      isProviderAvailableForInterval({
        ...available,
        now: new Date("2099-09-20T08:30:00.000Z"),
      }),
      false,
    );
  });
});

describe("Fmap coordinate privacy", () => {
  it("returns a deterministic point 300–650 metres from the private address", () => {
    const exact = { latitude: 10.7769, longitude: 106.7009 };
    const first = obfuscateCoordinates(
      "profile-1",
      exact.latitude,
      exact.longitude,
      "test-secret",
    );
    const second = obfuscateCoordinates(
      "profile-1",
      exact.latitude,
      exact.longitude,
      "test-secret",
    );
    assert.deepEqual(first, second);

    const northMetres = (first.latitude - exact.latitude) * 111_320;
    const eastMetres =
      (first.longitude - exact.longitude) *
      111_320 *
      Math.cos((exact.latitude * Math.PI) / 180);
    const distance = Math.hypot(northMetres, eastMetres);
    assert.ok(
      distance >= 299 && distance <= 651,
      `unexpected offset: ${distance}`,
    );
  });
});

describe("paddedBounds", () => {
  it("returns null for an empty array", () => {
    assert.equal(paddedBounds([]), null);
  });

  it("pads and rounds a single point outward to 2 decimals", () => {
    assert.deepEqual(
      paddedBounds([{ latitude: 10.7769, longitude: 106.7009 }]),
      { north: 10.83, south: 10.72, east: 106.76, west: 106.65 },
    );
  });

  it("never returns a box tight enough to reveal a lone provider", () => {
    const bounds = paddedBounds([{ latitude: 21.0285, longitude: 105.8542 }]);
    assert.ok(bounds);
    assert.ok(bounds.north - bounds.south >= 0.1);
    assert.ok(bounds.east - bounds.west >= 0.1);
  });

  it("covers every point with padding on each side", () => {
    const bounds = paddedBounds([
      { latitude: 10.7, longitude: 106.6 },
      { latitude: 10.9, longitude: 106.8 },
    ]);
    assert.ok(bounds);
    assert.ok(bounds.north >= 10.95 && bounds.south <= 10.65);
    assert.ok(bounds.east >= 106.85 && bounds.west <= 106.55);
  });
});
