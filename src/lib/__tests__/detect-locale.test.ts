import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectLocale } from "@/i18n/detect-locale";

const LOCALES = ["en", "vi"] as const;
const pick = (header: string | null) => detectLocale(header, LOCALES, "vi");

describe("detectLocale", () => {
  it("keeps Vietnamese when English is only a fallback", () => {
    // What Chrome sends in Vietnam; this used to come out English.
    assert.equal(pick("vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"), "vi");
    assert.equal(pick("vi-VN,en;q=0.9"), "vi");
  });

  it("chooses English when it is preferred", () => {
    assert.equal(pick("en-US,en;q=0.9,vi;q=0.8"), "en");
    assert.equal(pick("en-GB"), "en");
  });

  it("follows the weights, not only the order", () => {
    assert.equal(pick("en;q=0.5,vi;q=0.9"), "vi");
  });

  it("skips languages we do not offer", () => {
    assert.equal(pick("fr-FR,fr;q=0.9,en;q=0.8"), "en");
    assert.equal(pick("ja-JP,ja;q=0.9"), "vi");
  });

  it("falls back to Vietnamese with no usable header", () => {
    assert.equal(pick(null), "vi");
    assert.equal(pick(""), "vi");
    assert.equal(pick("*"), "vi");
    assert.equal(pick("en;q=0"), "vi");
  });

  it("does not match a language inside another tag", () => {
    // "en" is a substring of "zen"; the old check would have matched it.
    assert.equal(pick("zen"), "vi");
  });
});
