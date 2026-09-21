// Shared rental-day math — this exact rounding rule
// (`Math.round((end - start) / 86_400_000)`) used to be reimplemented
// independently in 4 places (services/orders.ts, components/cart/
// cart-utils.ts, cart-item-row.tsx, and shop/[productId]/
// product-purchase-panel.tsx) with no shared source of truth. Deliberately
// does NOT apply a minimum-days floor itself — callers want different
// floors/fallbacks (e.g. a live pre-purchase price preview shows 0 before
// both dates are picked, while an actual order always charges for at
// least 1 day), so this only dedupes the part that's genuinely one
// business rule: how many days a rental window spans.
export function calculateRentalDays(start: Date | string, end: Date | string) {
  const startMs =
    typeof start === "string" ? new Date(start).getTime() : start.getTime();
  const endMs =
    typeof end === "string" ? new Date(end).getTime() : end.getTime();
  return Math.round((endMs - startMs) / 86_400_000);
}

export type DeliveryMethod = "SHIP" | "PICKUP";

export type DeliveryFeeResult =
  { ok: true; fee: number } | { ok: false; reason: "shop_does_not_deliver" };

/**
 * What the delivery line of an order costs. Collecting at the shop is always
 * free; shipping costs whatever flat fee the shop set on its profile.
 *
 * A shop with no fee set has not opted into delivering at all — that is a
 * refusal, not free shipping. Treating null as 0 would quietly commit a shop
 * to a delivery it never agreed to, which matters because the platform does
 * not handle this money: the shop would be the one out of pocket.
 */
export function resolveDeliveryFee(
  method: DeliveryMethod,
  shopFee: number | null | undefined,
): DeliveryFeeResult {
  if (method === "PICKUP") return { ok: true, fee: 0 };
  if (shopFee === null || shopFee === undefined) {
    return { ok: false, reason: "shop_does_not_deliver" };
  }
  return { ok: true, fee: Math.max(0, shopFee) };
}
