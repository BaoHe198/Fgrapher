import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cn } from "@/lib/utils";

// Every brand type-scale class must be known to tailwind-merge as a font
// size; an unknown one is taken for a colour and silently drops the real
// colour class next to it (18/11/2026: size="sm" Buttons lost their label
// colour because text-meta was missing).
describe("cn — brand type scale vs. text colour", () => {
  for (const size of ["text-meta", "text-body-sm", "text-heading-sm"]) {
    it(`giữ cả ${size} và màu chữ`, () => {
      assert.equal(
        cn("text-text-on-brand", size),
        `text-text-on-brand ${size}`,
      );
    });
  }

  it("vẫn gộp hai cỡ chữ thành cỡ sau cùng", () => {
    assert.equal(cn("text-body-sm", "text-meta"), "text-meta");
  });
});
