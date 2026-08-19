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
    user: { id: string; name: string | null; firstName: string | null; profiles: { shopName: string | null }[] };
  };
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
  }, [load]);

  const updateQuantity = async (id: string, quantity: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity } : item)));
    await fetch(`/api/cart/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    load();
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/cart/${id}`, { method: "DELETE" });
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, isLoading, itemCount, reload: load, updateQuantity, removeItem };
}
