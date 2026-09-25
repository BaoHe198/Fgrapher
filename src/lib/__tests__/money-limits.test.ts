import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_VND_AMOUNT } from "@/lib/validations/money";
import { productSchema } from "@/lib/validations/product";
import { createOfferSchema } from "@/lib/validations/service-request";

const product = {
  name: "Sony A7 IV",
  category: "Camera body",
  type: "SALE",
  condition: "NEW",
  stock: 1,
  isActive: true,
  images: [],
} as const;

describe("money limits", () => {
  it("rejects a price with digits appended by mistake", () => {
    const res = productSchema.safeParse({
      ...product,
      price: 4500000044000000,
    });
    assert.equal(res.success, false);
  });

  it("accepts a real price and the limit itself", () => {
    assert.equal(
      productSchema.safeParse({ ...product, price: 45_000_000 }).success,
      true,
    );
    assert.equal(
      productSchema.safeParse({ ...product, price: MAX_VND_AMOUNT }).success,
      true,
    );
  });

  it("caps offer prices too", () => {
    assert.equal(
      createOfferSchema.safeParse({ proposedPrice: MAX_VND_AMOUNT + 1 })
        .success,
      false,
    );
  });
});
