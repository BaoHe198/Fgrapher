import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchParams } from "@/services/search";
import { normalizeSort, sanitizeSearchParams } from "@/lib/search-params";

// The shapes /browse builds from a URL, where anything can appear.
const fromUrl = (p: Record<string, unknown>) => p as unknown as SearchParams;

describe("sanitizeSearchParams", () => {
  it("drops unknown enum values instead of passing them to the database", () => {
    const out = sanitizeSearchParams(
      fromUrl({
        categories: ["NUDE", "WEDDING"],
        serviceKinds: ["FOO"],
        experienceLevel: ["X"],
      }),
    );
    assert.deepEqual(out.categories, ["WEDDING"]);
    assert.equal(out.serviceKinds, undefined);
    assert.equal(out.experienceLevel, undefined);
  });

  it("turns non-numbers into no filter, and clamps the rest", () => {
    const out = sanitizeSearchParams({
      minPrice: Number("abc"),
      maxPrice: -5,
      minRating: 9,
      heightMin: Number("abc"),
      page: -1,
      limit: 1000,
    });
    assert.equal(out.minPrice, undefined);
    assert.equal(out.maxPrice, 0);
    assert.equal(out.minRating, 5);
    assert.equal(out.heightMin, undefined);
    assert.equal(out.page, 1);
    assert.equal(out.limit, 50);
  });

  it("treats a NaN page as the first page and floors fractions", () => {
    assert.equal(sanitizeSearchParams({ page: Number("abc") }).page, undefined);
    assert.equal(sanitizeSearchParams({ page: 2.7 }).page, 2);
  });

  it("trims and caps the text query", () => {
    assert.equal(sanitizeSearchParams({ q: "   " }).q, undefined);
    assert.equal(sanitizeSearchParams({ q: "a".repeat(3000) }).q?.length, 100);
    assert.equal(sanitizeSearchParams({ q: " Minh Anh " }).q, "Minh Anh");
  });

  it("leaves roles for searchProfiles to narrow", () => {
    const out = sanitizeSearchParams(fromUrl({ roles: ["HACKER"] }));
    assert.deepEqual(out.roles, ["HACKER"]);
  });
});

describe("normalizeSort", () => {
  it("falls back to rating for anything unknown", () => {
    assert.equal(normalizeSort("bogus"), "rating");
    assert.equal(normalizeSort(undefined), "rating");
    assert.equal(normalizeSort("price_asc"), "price_asc");
  });
});
