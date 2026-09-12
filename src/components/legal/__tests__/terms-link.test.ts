import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

// A consent checkbox that says "I agree to the … terms" with nothing to click
// asks the user to accept something they cannot read. Both of the app's
// consent checkboxes shipped that way. These guard the fix.

const CONSENT_CHECKBOXES = [
  {
    file: "src/app/(public)/booking/[providerId]/booking-wizard.tsx",
    key: "stepReview.agreeTerms",
  },
  {
    file: "src/app/(public)/checkout/checkout-content.tsx",
    key: "agreeTerms",
  },
];

describe("consent checkboxes link to the terms they ask you to accept", () => {
  for (const { file, key } of CONSENT_CHECKBOXES) {
    it(`${file} renders its consent label as rich text`, () => {
      const src = read(file);
      // t.rich, not t — a plain t() renders the markup as literal characters
      // and there is no link.
      assert.match(
        src,
        new RegExp(`t\\.rich\\("${key.replace(".", "\\.")}",\\s*\\{\\s*terms:`),
        `${file} stopped rendering its consent label with t.rich`,
      );
      assert.match(src, /termsChunk/);
    });
  }

  it("the shared chunk points at /terms, opens a new tab, and can't toggle the box", () => {
    const src = read("src/components/legal/terms-link.tsx");
    assert.match(src, /href="\/terms"/);
    // The flows these sit in are multi-step; navigating away in place would
    // lose the user's place.
    assert.match(src, /target="_blank"/);
    assert.match(src, /rel="noopener noreferrer"/);
    // Checkbox wraps its label in <label htmlFor>, so without this a click on
    // the link also flips the consent it belongs to.
    assert.match(src, /stopPropagation\(\)/);
  });
});

describe("the consent strings carry the link markup", () => {
  const locales = ["vi", "en"] as const;

  for (const locale of locales) {
    it(`${locale}.json wraps the terms wording in <terms>`, () => {
      const messages = JSON.parse(read(`src/messages/${locale}.json`));
      const booking = messages.publicPages.booking.stepReview
        .agreeTerms as string;
      const checkout = messages.publicPages.checkout.agreeTerms as string;

      for (const [name, value] of [
        ["booking", booking],
        ["checkout", checkout],
      ] as const) {
        assert.match(
          value,
          /<terms>.+<\/terms>/,
          `${locale} ${name} consent string lost its <terms> markup, so t.rich has nothing to turn into a link`,
        );
      }
    });
  }
});
