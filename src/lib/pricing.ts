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
