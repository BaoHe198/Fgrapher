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
    {
      shopName: string;
      deliveryFee: number | null;
      pickupArea: string | null;
      items: CartItemWithProduct[];
    }
  >();
  for (const item of items) {
    const shopId = item.product.user.id;
    const profile = item.product.user.profiles[0];
    const shopName =
      profile?.shopName ??
      item.product.user.firstName ??
      item.product.user.name ??
      fallbackShopName;
    // Ward + province only. The shop's street address is private (see the
    // Profile model) — the shop sends it once the order is confirmed.
    const pickupArea =
      [profile?.ward?.name, profile?.province?.name]
        .filter(Boolean)
        .join(", ") || null;
    if (!groups.has(shopId))
      groups.set(shopId, {
        shopName,
        deliveryFee: profile?.deliveryFee ?? null,
        pickupArea,
        items: [],
      });
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

export interface CartShopGroup {
  shopId: string;
  shopName: string;
  deliveryFee: number | null;
  pickupArea: string | null;
  items: CartItemWithProduct[];
}

/**
 * What delivery adds to the cart, and which shops cannot deliver at all.
 * A cart spanning several shops pays each shop's own fee, because it becomes
 * one order per shop.
 */
export function deliveryTotals(
  groups: CartShopGroup[],
  method: "SHIP" | "PICKUP",
) {
  if (method === "PICKUP") return { fee: 0, undeliverable: [] as string[] };
  const undeliverable = groups
    .filter((group) => group.deliveryFee === null)
    .map((group) => group.shopName);
  const fee = groups.reduce(
    (sum, group) => sum + Math.max(0, group.deliveryFee ?? 0),
    0,
  );
  return { fee, undeliverable };
}
