import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  REQUEST_ERROR_KEYS,
  requestErrorKey,
} from "@/lib/request-error-messages";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

describe("F Booking error messages", () => {
  it("every thrown OfferError / ServiceRequestError message has a key", () => {
    const thrown = new Set<string>();
    for (const file of [
      "src/services/request-offers.ts",
      "src/services/service-requests.ts",
    ]) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(
        /(?:new (?:OfferError|ServiceRequestError)\(|super\()\s*\n?\s*["`]([^"`]+)["`]/g,
      )) {
        thrown.add(m[1]);
      }
    }
    assert.ok(thrown.size > 10);
    for (const message of thrown) {
      assert.ok(requestErrorKey(message), `no key for "${message}"`);
    }
  });

  it("keys exist in both languages", () => {
    for (const key of [...Object.values(REQUEST_ERROR_KEYS), "unknown"]) {
      assert.ok(
        (vi.apiMessages.requestErrors as Record<string, string>)[key],
        `vi ${key}`,
      );
      assert.ok(
        (en.apiMessages.requestErrors as Record<string, string>)[key],
        `en ${key}`,
      );
    }
  });
});
