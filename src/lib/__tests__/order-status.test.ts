import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OrderStatus } from "@prisma/client";

import {
  ACTIVE_RENTAL_STATUSES,
  checkOrderTransition,
  VALID_ORDER_TRANSITIONS,
} from "@/lib/order-status";

// The property that matters: an order that is finished stays finished, and
// a rental only counts as "back" once it reaches RETURNED — everything else
// keeps the item unavailable, which is what stops a double booking.

describe("checkOrderTransition", () => {
  it("walks the shipped leg of a sale", () => {
    assert.deepEqual(checkOrderTransition("PENDING", "CONFIRMED", false), {
      ok: true,
    });
    assert.deepEqual(checkOrderTransition("CONFIRMED", "SHIPPED", false), {
      ok: true,
    });
    assert.deepEqual(checkOrderTransition("SHIPPED", "DELIVERED", false), {
      ok: true,
    });
  });

  it("walks the pick-up leg of a rental", () => {
    assert.deepEqual(checkOrderTransition("CONFIRMED", "PICKED_UP", true), {
      ok: true,
    });
    assert.deepEqual(checkOrderTransition("PICKED_UP", "RETURNED", true), {
      ok: true,
    });
  });

  it("lets an overdue rental still come back", () => {
    assert.deepEqual(checkOrderTransition("PICKED_UP", "OVERDUE", true), {
      ok: true,
    });
    assert.deepEqual(checkOrderTransition("OVERDUE", "RETURNED", true), {
      ok: true,
    });
  });

  it("refuses to move an order backwards", () => {
    const result = checkOrderTransition("DELIVERED", "PENDING", false);
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.reason : "", /delivered/);
  });

  it("treats cancelled and returned as final", () => {
    for (const from of ["CANCELLED", "RETURNED"] as OrderStatus[]) {
      assert.deepEqual(VALID_ORDER_TRANSITIONS[from], []);
      assert.equal(checkOrderTransition(from, "CONFIRMED", true).ok, false);
    }
  });

  it("refuses a rental-only status on a sale-only order", () => {
    const result = checkOrderTransition("CONFIRMED", "PICKED_UP", false);
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.reason : "", /rental/);
  });

  it("keeps an item unavailable in every status except cancelled and returned", () => {
    const every = Object.keys(VALID_ORDER_TRANSITIONS) as OrderStatus[];
    const free = every.filter((s) => !ACTIVE_RENTAL_STATUSES.includes(s));
    assert.deepEqual(free.sort(), ["CANCELLED", "RETURNED"]);
  });
});
