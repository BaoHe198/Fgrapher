import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOnboardingDestination,
  isSafeInternalPath,
  parseBillingInterval,
  pendingPaidRoles,
} from "@/lib/onboarding-destination";
import type { Role } from "@prisma/client";

// The regression these guard: registration used to build
// /onboarding/billing?roles=…&interval=… and hand it to signIn() as a
// callbackUrl. Requiring email verification made registration stop signing
// anyone in, so that destination was computed and thrown away — a paid
// provider verified, signed in, landed on /dashboard with an inactive role,
// and was never prompted to pay.

const roles = (
  entries: Array<[Role, boolean]>,
): Array<{ role: Role; active: boolean }> =>
  entries.map(([role, active]) => ({ role, active }));

describe("pendingPaidRoles", () => {
  it("finds a paid role still awaiting checkout", () => {
    assert.deepEqual(
      pendingPaidRoles(
        roles([
          ["CUSTOMER", true],
          ["PHOTOGRAPHER", false],
        ]),
      ),
      ["PHOTOGRAPHER"],
    );
  });

  it("ignores an already-activated paid role", () => {
    assert.deepEqual(
      pendingPaidRoles(
        roles([
          ["CUSTOMER", true],
          ["PHOTOGRAPHER", true],
        ]),
      ),
      [],
    );
  });

  it("never treats CUSTOMER as owing money", () => {
    // CUSTOMER is free and always coexists; an inactive one must not drag
    // someone into checkout.
    assert.deepEqual(pendingPaidRoles(roles([["CUSTOMER", false]])), []);
  });
});

describe("buildOnboardingDestination", () => {
  it("routes a pending paid provider to billing, keeping their interval", () => {
    const destination = buildOnboardingDestination({
      billingEnabled: true,
      pendingRoles: ["PHOTOGRAPHER"],
      interval: "year",
    });
    assert.equal(
      destination,
      "/onboarding/billing?roles=PHOTOGRAPHER&interval=year",
    );
  });

  it("preserves a monthly choice explicitly", () => {
    assert.match(
      buildOnboardingDestination({
        billingEnabled: true,
        pendingRoles: ["STUDIO"],
        interval: "month",
      }),
      /interval=month/,
    );
  });

  it("sends a customer straight to the dashboard", () => {
    assert.equal(
      buildOnboardingDestination({
        billingEnabled: true,
        pendingRoles: [],
        interval: "month",
      }),
      "/dashboard",
    );
  });

  it("skips billing entirely while the flag is off", () => {
    // Today's configuration, and permanently so for Stripe: registration
    // already granted a free plan, so there is nothing to collect. This is
    // what makes the whole change a no-op in the current setup.
    assert.equal(
      buildOnboardingDestination({
        billingEnabled: false,
        pendingRoles: ["PHOTOGRAPHER"],
        interval: "year",
      }),
      "/dashboard",
    );
  });

  it("always produces a path that is safe to use as a callbackUrl", () => {
    for (const interval of ["month", "year"] as const) {
      for (const pending of [[], ["PHOTOGRAPHER"], ["STUDIO"]] as Role[][]) {
        for (const billingEnabled of [true, false]) {
          const destination = buildOnboardingDestination({
            billingEnabled,
            pendingRoles: pending,
            interval,
          });
          assert.ok(
            isSafeInternalPath(destination),
            `unsafe destination: ${destination}`,
          );
        }
      }
    }
  });
});

describe("parseBillingInterval", () => {
  it("keeps a yearly choice", () => {
    assert.equal(parseBillingInterval("year"), "year");
  });

  it("falls back to monthly rather than throwing", () => {
    // A mangled preference must never block someone from verifying.
    for (const value of ["month", "", "annual", undefined, null, 7, {}]) {
      assert.equal(parseBillingInterval(value), "month");
    }
  });
});

describe("isSafeInternalPath", () => {
  it("accepts app-relative paths", () => {
    assert.equal(isSafeInternalPath("/dashboard"), true);
    assert.equal(
      isSafeInternalPath("/onboarding/billing?roles=STUDIO&interval=year"),
      true,
    );
  });

  it("rejects absolute URLs", () => {
    assert.equal(isSafeInternalPath("https://evil.example/x"), false);
    assert.equal(isSafeInternalPath("javascript:alert(1)"), false);
  });

  it("rejects protocol-relative URLs that merely start with a slash", () => {
    // Browsers follow these off-site despite the leading slash.
    assert.equal(isSafeInternalPath("//evil.example"), false);
    assert.equal(isSafeInternalPath("/\\evil.example"), false);
  });

  it("rejects smuggled control characters", () => {
    assert.equal(isSafeInternalPath("/\nhttps://evil.example"), false);
    assert.equal(isSafeInternalPath("/\tfoo"), false);
  });

  it("rejects non-strings and empties", () => {
    for (const value of ["", undefined, null, 0, {}, []]) {
      assert.equal(isSafeInternalPath(value), false);
    }
  });
});
