import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDeliveryFee } from "@/lib/pricing";

describe("resolveDeliveryFee", () => {
  it("never charges for collecting at the shop", () => {
    assert.deepEqual(resolveDeliveryFee("PICKUP", 50_000), {
      ok: true,
      fee: 0,
    });
    assert.deepEqual(resolveDeliveryFee("PICKUP", null), { ok: true, fee: 0 });
  });

  it("charges the shop's flat fee for delivery", () => {
    assert.deepEqual(resolveDeliveryFee("SHIP", 30_000), {
      ok: true,
      fee: 30_000,
    });
  });

  it("treats a shop with no fee as not delivering, not as free shipping", () => {
    assert.deepEqual(resolveDeliveryFee("SHIP", null), {
      ok: false,
      reason: "shop_does_not_deliver",
    });
    assert.deepEqual(resolveDeliveryFee("SHIP", undefined), {
      ok: false,
      reason: "shop_does_not_deliver",
    });
  });

  it("clamps a negative fee to zero rather than discounting the order", () => {
    assert.deepEqual(resolveDeliveryFee("SHIP", -10_000), {
      ok: true,
      fee: 0,
    });
  });

  it("keeps a zero fee as genuine free delivery", () => {
    assert.deepEqual(resolveDeliveryFee("SHIP", 0), { ok: true, fee: 0 });
  });
});
