import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { BOOKING_ERROR_KEYS } from "@/lib/booking-error-messages";
import vi from "@/messages/vi.json";
import en from "@/messages/en.json";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : sources(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("booking error messages", () => {
  it("every thrown BookingActionError message has a translation", () => {
    const thrown = new Set<string>();
    for (const file of sources("src")) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/new BookingActionError\(\s*"([^"]+)"/g)) {
        thrown.add(m[1]);
      }
    }
    assert.ok(thrown.size > 10, "found the thrown messages");
    for (const message of thrown) {
      assert.ok(
        BOOKING_ERROR_KEYS[message],
        `no translation key for "${message}"`,
      );
    }
  });

  it("every key exists in both languages", () => {
    const viKeys = vi.apiMessages.bookingErrors as Record<string, string>;
    const enKeys = en.apiMessages.bookingErrors as Record<string, string>;
    for (const key of [...Object.values(BOOKING_ERROR_KEYS), "unknown"]) {
      assert.ok(viKeys[key], `vi missing ${key}`);
      assert.ok(enKeys[key], `en missing ${key}`);
    }
  });
});
