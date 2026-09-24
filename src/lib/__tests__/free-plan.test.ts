import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  FREE_PLAN,
  FREE_PLAN_TERM_MONTHS,
  freePlanTermEnd,
  renewsAutomatically,
} from "@/lib/free-plan";

const repoRoot = path.resolve(__dirname, "../../..");
const read = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("free plan auto-renewal", () => {
  it("renews a local free plan while billing is off", () => {
    assert.equal(
      renewsAutomatically(
        { plan: FREE_PLAN, stripeSubscriptionId: null },
        false,
      ),
      true,
    );
  });

  it("stops renewing once billing is switched on", () => {
    assert.equal(
      renewsAutomatically(
        { plan: FREE_PLAN, stripeSubscriptionId: null },
        true,
      ),
      false,
    );
  });

  // A plan paid through MoMo/ZaloPay/bank transfer, or one an admin set
  // with a deliberate end date, must still end when it says it does.
  it("never renews a plan that is not the free plan", () => {
    for (const plan of ["PRO", "STUDIO", "PHOTOGRAPHER", null]) {
      assert.equal(
        renewsAutomatically({ plan, stripeSubscriptionId: null }, false),
        false,
        `plan ${plan} must not renew itself`,
      );
    }
  });

  it("leaves a Stripe subscription's lifecycle to Stripe", () => {
    assert.equal(
      renewsAutomatically(
        { plan: FREE_PLAN, stripeSubscriptionId: "sub_123" },
        false,
      ),
      false,
    );
  });

  it("gives each term the same length as the signup term", () => {
    const from = new Date("2026-09-24T00:00:00.000Z");
    const end = freePlanTermEnd(from);
    const months =
      (end.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - from.getUTCMonth());
    assert.equal(months, FREE_PLAN_TERM_MONTHS);
    assert.equal(
      from.toISOString(),
      "2026-09-24T00:00:00.000Z",
      "input untouched",
    );
  });

  // The rule lives in one module but acts in four places; a regression in
  // any one of them strands providers again. Pin the wiring, not just the
  // predicate.
  it("is wired into every place a free plan can lapse", () => {
    assert.match(
      read("src/lib/auth-helpers.ts"),
      /renewsAutomatically\(subscription, features\.billingEnabled\)/,
      "paid-role checks must treat a self-renewing plan as usable",
    );
    const payments = read("src/services/payments.ts");
    assert.match(payments, /plan: FREE_PLAN/, "the cron must renew free plans");
    assert.match(payments, /freePlanTermEnd\(now\)/);
    assert.match(
      read("src/services/subscription.ts"),
      /plan: FREE_PLAN, expiresAt/,
      "signup must assign the same plan name the renewal looks for",
    );
    assert.match(
      read("src/services/admin.ts"),
      /NOT: \{ plan: FREE_PLAN \}/,
      "self-renewing plans are not an admin alert",
    );
  });
});
