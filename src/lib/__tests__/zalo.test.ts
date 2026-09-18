import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isValidZaloUrl, normalizeZaloUrl } from "@/lib/zalo";

describe("Zalo contact links", () => {
  it("accepts official HTTPS Zalo profile and chat links", () => {
    assert.equal(
      normalizeZaloUrl("https://zalo.me/0901234567"),
      "https://zalo.me/0901234567",
    );
    assert.equal(isValidZaloUrl("https://chat.zalo.me/example"), true);
  });

  it("rejects lookalike domains and insecure links", () => {
    assert.equal(isValidZaloUrl("https://zalo.me.evil.test/account"), false);
    assert.equal(isValidZaloUrl("http://zalo.me/account"), false);
    assert.equal(isValidZaloUrl("https://user@zalo.me/account"), false);
    assert.equal(isValidZaloUrl("https://zalo.me:8443/account"), false);
    assert.equal(isValidZaloUrl("javascript:alert(1)"), false);
  });

  it("allows an empty value so a provider can remove the contact link", () => {
    assert.equal(isValidZaloUrl("  "), true);
    assert.equal(normalizeZaloUrl("  "), null);
  });
});
