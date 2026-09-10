import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBillingInterval,
  resolveOnboardingNext,
} from "@/lib/onboarding-destination";
import {
  rememberAttemptedEmail,
  takeAttemptedSignIn,
} from "@/lib/resend-verification";
import {
  buildLoginCallbackPath,
  buildVerificationPath,
} from "@/lib/verification-link";
import type { Role } from "@prisma/client";

// Follows the billing period along the whole route it actually travels:
//
//   signup input
//     → the query string of the emailed verification link
//     → what the verify endpoint reads back off that link
//     → the `next` destination it returns
//     → the encoded callbackUrl on the login button
//
// Each hop calls the same function production calls, composed in the same
// order, so a break in the wiring between two of them shows up here — which
// is the gap the earlier per-helper tests left. What it does NOT cover: the
// HTTP handlers, the database read behind getPendingPaidRoles, and the
// actual email send. Those need the e2e suite.

/** The hop the verify endpoint performs: link query → validated interval. */
function readIntervalFromLink(path: string) {
  const query = new URLSearchParams(path.slice(path.indexOf("?") + 1));
  return parseBillingInterval(query.get("interval"));
}

/** The hop the login page performs: callbackUrl → the path signIn receives. */
function readCallbackFromLoginPath(loginPath: string) {
  const query = new URLSearchParams(
    loginPath.slice(loginPath.indexOf("?") + 1),
  );
  return query.get("callbackUrl");
}

function runChain({
  interval,
  pendingRoles,
  billingEnabled,
  rawToken = "a".repeat(64),
}: {
  interval: "month" | "year" | undefined;
  pendingRoles: Role[];
  billingEnabled: boolean;
  rawToken?: string;
}) {
  const verificationPath = buildVerificationPath({ rawToken, interval });
  const readBack = readIntervalFromLink(verificationPath);
  const next = resolveOnboardingNext({
    billingEnabled,
    pendingRoles,
    interval: readBack,
  });
  const loginPath = buildLoginCallbackPath(next);
  return {
    verificationPath,
    readBack,
    next,
    loginPath,
    callbackUrl: readCallbackFromLoginPath(loginPath),
  };
}

describe("signup → verification link → login callback", () => {
  it("delivers a yearly provider to yearly checkout", () => {
    const chain = runChain({
      interval: "year",
      pendingRoles: ["PHOTOGRAPHER"],
      billingEnabled: true,
    });

    assert.match(chain.verificationPath, /interval=year/);
    assert.equal(chain.readBack, "year");
    assert.equal(
      chain.next,
      "/onboarding/billing?roles=PHOTOGRAPHER&interval=year",
    );
    // The nested query has to survive being embedded in another one.
    assert.equal(
      chain.callbackUrl,
      "/onboarding/billing?roles=PHOTOGRAPHER&interval=year",
    );
  });

  it("delivers a monthly provider to monthly checkout", () => {
    const chain = runChain({
      interval: "month",
      pendingRoles: ["STUDIO"],
      billingEnabled: true,
    });

    assert.equal(chain.readBack, "month");
    assert.equal(
      chain.callbackUrl,
      "/onboarding/billing?roles=STUDIO&interval=month",
    );
  });

  it("keeps the token intact alongside the interval", () => {
    const rawToken = "b".repeat(64);
    const { verificationPath } = runChain({
      interval: "year",
      pendingRoles: ["STUDIO"],
      billingEnabled: true,
      rawToken,
    });
    const query = new URLSearchParams(
      verificationPath.slice(verificationPath.indexOf("?") + 1),
    );
    assert.equal(query.get("token"), rawToken);
  });

  it("sends a customer straight to the dashboard", () => {
    const chain = runChain({
      interval: undefined,
      pendingRoles: [],
      billingEnabled: true,
    });
    assert.equal(chain.next, "/dashboard");
    assert.equal(chain.callbackUrl, "/dashboard");
  });

  it("is inert while billing is switched off", () => {
    // Today's configuration: registration already granted a free plan, so
    // there is nothing for checkout to collect.
    const chain = runChain({
      interval: "year",
      pendingRoles: ["PHOTOGRAPHER"],
      billingEnabled: false,
    });
    assert.equal(chain.next, "/dashboard");
  });

  it("survives a link whose interval was mangled in transit", () => {
    const next = resolveOnboardingNext({
      billingEnabled: true,
      pendingRoles: ["PHOTOGRAPHER"],
      interval: parseBillingInterval("annual"),
    });
    // Falls back to monthly rather than breaking verification.
    assert.match(next, /interval=month/);
  });
});

describe("resend → verification link", () => {
  it("keeps a yearly choice on a replacement link", () => {
    // The regression: the resend form posted only the address, so anyone
    // whose first email failed — the likeliest person to use resend —
    // silently got a monthly link.
    const resent = buildVerificationPath({
      rawToken: "c".repeat(64),
      interval: "year",
    });
    assert.equal(readIntervalFromLink(resent), "year");
  });

  it("carries the period from the login prompt through storage", () => {
    // The login page's prompt is the one context where the period isn't in
    // the URL: NextAuth's redirect keeps only its own error params.
    const storage = (() => {
      const data = new Map<string, string>();
      return {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
      };
    })();

    rememberAttemptedEmail("nguyen@example.com", "year", storage);
    const { email, interval } = takeAttemptedSignIn(storage);

    assert.equal(email, "nguyen@example.com");
    const resent = buildVerificationPath({
      rawToken: "d".repeat(64),
      interval,
    });
    assert.equal(readIntervalFromLink(resent), "year");
  });
});
