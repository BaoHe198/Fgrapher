import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { CURRENT_POLICY_VERSION } from "@/lib/constants";
import {
  hasAnalyticsCookieConsent,
  parseCookieConsent,
  serializeCookieConsent,
} from "@/lib/cookie-consent";
import vi from "@/messages/vi.json";
import en from "@/messages/en.json";

const decidedAt = "2026-09-28T03:00:00.000Z";

describe("cookie consent", () => {
  it("round-trips a choice", () => {
    for (const analytics of [true, false]) {
      const raw = serializeCookieConsent({
        version: CURRENT_POLICY_VERSION,
        analytics,
        decidedAt,
      });
      assert.deepEqual(parseCookieConsent(raw), {
        version: CURRENT_POLICY_VERSION,
        analytics,
        decidedAt,
      });
    }
  });

  it("asks again after the policy version changes", () => {
    const raw = serializeCookieConsent({
      version: "2020-01-01-v0",
      analytics: true,
      decidedAt,
    });
    assert.equal(parseCookieConsent(raw), null);
    assert.equal(hasAnalyticsCookieConsent(raw), false);
  });

  it("treats a missing or tampered cookie as no consent", () => {
    for (const raw of [
      undefined,
      "",
      "yes",
      "{}",
      "null",
      JSON.stringify({ v: CURRENT_POLICY_VERSION, a: "1", t: decidedAt }),
      JSON.stringify({ v: CURRENT_POLICY_VERSION, a: 1, t: "not a date" }),
    ]) {
      assert.equal(hasAnalyticsCookieConsent(raw), false, String(raw));
    }
  });

  it("never sets the analytics cookie without consent", () => {
    // The view route is the one place fg_pv is written; the write must sit
    // behind the consent check.
    const route = readFileSync("src/app/api/profiles/view/route.ts", "utf8");
    const gate = route.indexOf("if (!cookieAllowed) return result(true);");
    const write = route.indexOf("cookieStore.set(");
    assert.ok(gate > 0 && write > gate);
  });

  it("offers both answers in both languages", () => {
    for (const catalog of [vi, en]) {
      const c = catalog.cookieConsent;
      assert.ok(c.necessaryOnly && c.allowAnalytics && c.saveFailed);
    }
  });
});
