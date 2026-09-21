import type { OrderStatus } from "@prisma/client";

/**
 * The order state machine, kept here rather than in services/orders.ts so it
 * can be tested without a database or a Stripe key — same reasoning as
 * lib/pricing.ts.
 *
 * Before this table `updateOrderStatus` accepted any status from any status,
 * so a delivered order could go back to pending and a returned rental could be
 * "shipped" again. The rental leg makes that actively dangerous, because the
 * set of in-flight statuses is what stops the same dress being rented to two
 * customers on the same weekend.
 *
 * Two rental legs: collected at the shop (CONFIRMED -> PICKED_UP) or shipped
 * out (CONFIRMED -> SHIPPED -> DELIVERED). Both end at RETURNED, through
 * OVERDUE if the rental window lapsed first.
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "PICKED_UP", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["OVERDUE", "RETURNED"],
  PICKED_UP: ["OVERDUE", "RETURNED"],
  OVERDUE: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Statuses that only mean anything once the order contains a rental item. */
export const RENTAL_ONLY_STATUSES: OrderStatus[] = [
  "PICKED_UP",
  "OVERDUE",
  "RETURNED",
];

/** Orders that still tie a rental up: anything not cancelled or returned. */
export const ACTIVE_RENTAL_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "PICKED_UP",
  "OVERDUE",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  PICKED_UP: "picked up",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
  RETURNED: "returned",
};

export type OrderTransitionCheck = { ok: true } | { ok: false; reason: string };

export function checkOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  hasRentalItem: boolean,
): OrderTransitionCheck {
  if (!VALID_ORDER_TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      reason: `An order cannot go from ${ORDER_STATUS_LABEL[from]} to ${ORDER_STATUS_LABEL[to]}`,
    };
  }
  if (RENTAL_ONLY_STATUSES.includes(to) && !hasRentalItem) {
    return {
      ok: false,
      reason: `Only a rental order can be marked ${ORDER_STATUS_LABEL[to]}`,
    };
  }
  return { ok: true };
}
