"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/utils";

import { CartItemRow } from "./cart-item-row";
import { cartTotals, groupByShop } from "./cart-utils";

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, itemCount, updateQuantity, removeItem, reload } = useCart();
  const groups = groupByShop(items);
  const totals = cartTotals(items);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reload();
      }}
    >
      <SheetTrigger
        render={
          <button type="button" className="relative">
            <ShoppingBag className="size-5 text-text-secondary" />
            {itemCount > 0 ? (
              <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold text-text-on-brand">
                {itemCount}
              </span>
            ) : null}
          </button>
        }
      />
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Your cart ({itemCount})</SheetTitle>
          <SheetDescription className="sr-only">Items in your shopping cart</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="size-12 text-text-tertiary" />
            <p className="text-body-lg font-semibold text-text-primary">Your cart is empty</p>
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<Link href="/shop" onClick={() => setOpen(false)} />}
            >
              Browse gear
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
              {groups.map((group) => (
                <div key={group.shopId} className="flex flex-col gap-3">
                  <span className="text-body-sm font-semibold text-text-tertiary">
                    {group.shopName}
                  </span>
                  {group.items.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border-subtle p-5">
              <div className="flex justify-between text-body-md">
                <span className="text-text-secondary">Subtotal</span>
                <span className="font-semibold text-text-primary">
                  {formatCurrency(totals.subtotal)}
                </span>
              </div>
              {totals.deposits > 0 ? (
                <div className="flex justify-between text-body-sm">
                  <span className="text-text-secondary">Deposits</span>
                  <span className="text-text-primary">{formatCurrency(totals.deposits)}</span>
                </div>
              ) : null}
              <p className="text-body-sm text-text-tertiary">Shipping calculated at checkout</p>
              <Button
                variant="accent"
                size="lg"
                className="w-full"
                nativeButton={false}
                render={<Link href="/cart" onClick={() => setOpen(false)} />}
              >
                Checkout
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Continue shopping
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
