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
    assert.equal(isValidZaloUrl("https://user@zalo.me/account"), false);
    assert.equal(isValidZaloUrl("https://zalo.me:8443/account"), false);
    assert.equal(isValidZaloUrl("javascript:alert(1)"), false);
  });

  it("accepts the QR link the Zalo app produces, upgraded to HTTPS", () => {
    // The QR code in the app encodes plain http://zaloapp.com/qr/... —
    // rejecting it made the field unusable for the people who use it.
    assert.equal(
      normalizeZaloUrl("http://zaloapp.com/qr/p/rxsrlnghn94i"),
      "https://zaloapp.com/qr/p/rxsrlnghn94i",
    );
    assert.equal(isValidZaloUrl("https://qr.zalo.me/abc"), true);
  });

  it("accepts a pasted link without its protocol and drops www.", () => {
    assert.equal(
      normalizeZaloUrl("zalo.me/0901234567"),
      "https://zalo.me/0901234567",
    );
    assert.equal(
      normalizeZaloUrl("https://www.zalo.me/0901234567"),
      "https://zalo.me/0901234567",
    );
  });

  it("allows an empty value so a provider can remove the contact link", () => {
    assert.equal(isValidZaloUrl("  "), true);
    assert.equal(normalizeZaloUrl("  "), null);
  });
});
