import type { Product, ProductImage } from "@prisma/client";
import { startTransition, useCallback, useEffect, useState } from "react";

export interface CartItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  type: "SALE" | "RENT";
  rentalStart: string | null;
  rentalEnd: string | null;
  product: Product & {
    images: ProductImage[];
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      profiles: {
        shopName: string | null;
        // null = this shop does not deliver at all, which is different from
        // a 0 fee (free delivery) — see lib/pricing.ts's resolveDeliveryFee.
        deliveryFee: number | null;
        province: { name: string } | null;
        ward: { name: string } | null;
      }[];
    };
  };
}

// Every useCart() instance (the header's cart icon, /cart, /checkout) loads
// on its own, so adding a product left the header's count stale until the
// icon was clicked (25/09 report). Anything that changes the cart announces
// it, and every instance reloads.
const CART_CHANGED = "fgrapher:cart-changed";

export function notifyCartChanged() {
  window.dispatchEvent(new Event(CART_CHANGED));
}

export function useCart() {
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/cart");
    const body = await res.json();
    startTransition(() => {
      setItems(body.data ?? []);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener(CART_CHANGED, onChanged);
    return () => window.removeEventListener(CART_CHANGED, onChanged);
  }, [load]);

  const updateQuantity = async (id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
    await fetch(`/api/cart/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    notifyCartChanged();
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/cart/${id}`, { method: "DELETE" });
    notifyCartChanged();
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    isLoading,
    itemCount,
    reload: load,
    updateQuantity,
    removeItem,
  };
}
