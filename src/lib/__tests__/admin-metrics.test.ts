import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { growthPercent, monthlyRecurringRevenue } from "@/lib/admin-metrics";
import { ROLE_PLANS } from "@/lib/constants/plans";
import { FREE_PLAN } from "@/lib/payments/free-plan";
import { vietnamMonthStart } from "@/lib/vietnam/date";

describe("monthlyRecurringRevenue", () => {
  it("counts nothing for free plans", () => {
    const free = Array.from({ length: 8 }, () => ({
      plan: FREE_PLAN,
      interval: "month",
      role: "PHOTOGRAPHER" as const,
    }));
    assert.equal(monthlyRecurringRevenue(free), 0);
  });

  it("counts a monthly plan at its monthly price", () => {
    assert.equal(
      monthlyRecurringRevenue([
        { plan: "PHOTOGRAPHER", interval: "month", role: "PHOTOGRAPHER" },
        { plan: FREE_PLAN, interval: "month", role: "STUDIO" },
      ]),
      ROLE_PLANS.PHOTOGRAPHER!.monthly,
    );
  });

  it("counts a yearly plan at a twelfth of what it is charged", () => {
    const studio = ROLE_PLANS.STUDIO!;
    const mrr = monthlyRecurringRevenue([
      { plan: "STUDIO", interval: "year", role: "STUDIO" },
    ]);
    assert.equal(mrr, Math.round(studio.yearly / 12));
    assert.ok(mrr < studio.monthly);
  });

  it("ignores a role with no price list", () => {
    assert.equal(
      monthlyRecurringRevenue([
        { plan: "CUSTOMER", interval: "month", role: "CUSTOMER" },
      ]),
      0,
    );
  });
});

describe("growthPercent", () => {
  it("is the change since the earlier count", () => {
    assert.equal(growthPercent(110, 100), 10);
    assert.equal(growthPercent(90, 100), -10);
    assert.equal(growthPercent(100, 100), 0);
  });

  it("is zero when there was nothing to grow from", () => {
    assert.equal(growthPercent(25, 0), 0);
  });
});

describe("vietnamMonthStart", () => {
  it("starts the month at midnight in Vietnam, not UTC", () => {
    // 02:00 on 1 December in Vietnam is still 30 November in UTC.
    const now = new Date("2026-11-30T19:00:00.000Z");
    assert.equal(
      vietnamMonthStart(now).toISOString(),
      "2026-11-30T17:00:00.000Z",
    );
  });

  it("goes back whole months, across a year boundary", () => {
    const now = new Date("2027-01-15T05:00:00.000Z");
    assert.equal(
      vietnamMonthStart(now, 1).toISOString(),
      "2026-11-30T17:00:00.000Z",
    );
    assert.equal(
      vietnamMonthStart(now).toISOString(),
      "2026-12-31T17:00:00.000Z",
    );
  });
});
