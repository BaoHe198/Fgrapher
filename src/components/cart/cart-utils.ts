import type { CartItemWithProduct } from "@/hooks/use-cart";
import { calculateRentalDays } from "@/lib/pricing";

// `fallbackShopName` is a caller-supplied, already-translated string — this
// is a plain utility (no React/next-intl hook access), so the caller
// (cart-drawer.tsx) resolves the "Shop" fallback via useTranslations and
// passes it in.
export function groupByShop(
  items: CartItemWithProduct[],
  fallbackShopName = "Shop",
) {
  const groups = new Map<
    string,
    { shopName: string; items: CartItemWithProduct[] }
  >();
  for (const item of items) {
    const shopId = item.product.user.id;
    const shopName =
      item.product.user.profiles[0]?.shopName ??
      item.product.user.firstName ??
      item.product.user.name ??
      fallbackShopName;
    if (!groups.has(shopId)) groups.set(shopId, { shopName, items: [] });
    groups.get(shopId)!.items.push(item);
  }
  return Array.from(groups.entries()).map(([shopId, group]) => ({
    shopId,
    ...group,
  }));
}

// Exported (not just used internally by itemLineTotal) so callers that
// need the day count for display — e.g. cart-item-row.tsx's "N days"
// label — use this instead of re-deriving it themselves.
export function itemRentalDays(item: CartItemWithProduct) {
  return item.rentalStart && item.rentalEnd
    ? Math.max(1, calculateRentalDays(item.rentalStart, item.rentalEnd))
    : 1;
}

export function itemLineTotal(item: CartItemWithProduct) {
  if (item.type === "RENT") {
    return (
      (item.product.rentalPrice ?? 0) * itemRentalDays(item) * item.quantity
    );
  }
  return (item.product.price ?? 0) * item.quantity;
}

export function cartTotals(items: CartItemWithProduct[]) {
  const subtotal = items.reduce((sum, item) => sum + itemLineTotal(item), 0);
  const deposits = items
    .filter((item) => item.type === "RENT")
    .reduce(
      (sum, item) => sum + (item.product.depositAmount ?? 0) * item.quantity,
      0,
    );
  return { subtotal, deposits, total: subtotal + deposits };
}
