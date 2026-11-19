import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { priceFilterClauses, startingPrice } from "@/lib/starting-price";

describe("a provider's starting price", () => {
  it("is the typed range when there is one", () => {
    assert.equal(
      startingPrice({ priceMin: 1_000_000, services: [{ price: 500_000 }] }),
      1_000_000,
    );
  });

  it("falls back to the cheapest active package", () => {
    // Was null: "Hỏi giá" on the card while the profile said "Từ 1.500.000₫".
    assert.equal(
      startingPrice({
        priceMin: null,
        services: [{ price: 3_000_000 }, { price: 1_500_000 }],
      }),
      1_500_000,
    );
  });

  it("is unknown only when there is neither", () => {
    assert.equal(startingPrice({ priceMin: null, services: [] }), null);
  });
});

describe("price filter", () => {
  it("adds nothing when no bound is given", () => {
    assert.deepEqual(priceFilterClauses(), []);
  });

  it("lets packages answer for a profile with no typed range", () => {
    const [max] = priceFilterClauses(undefined, 2_000_000);
    assert.deepEqual(max.OR[0], { priceMin: { lte: 2_000_000 } });
    assert.deepEqual(max.OR[1], {
      priceMin: null,
      services: { some: { isActive: true, price: { lte: 2_000_000 } } },
    });
  });

  it("matches an open-ended range and packages for a minimum", () => {
    const [min] = priceFilterClauses(2_500_000);
    assert.deepEqual(min.OR, [
      { priceMax: { gte: 2_500_000 } },
      { priceMax: null, priceMin: { gte: 2_500_000 } },
      {
        priceMax: null,
        priceMin: null,
        services: { some: { isActive: true, price: { gte: 2_500_000 } } },
      },
    ]);
  });

  it("returns one clause per bound, to be AND-ed", () => {
    assert.equal(priceFilterClauses(1, 2).length, 2);
  });

  it("only ever counts active packages", () => {
    const text = JSON.stringify(priceFilterClauses(1, 2));
    assert.equal(text.split('"isActive":true').length - 1, 2);
  });
});
