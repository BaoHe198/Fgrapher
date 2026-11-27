"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useBadges } from "@/components/providers/badges-provider";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/utils";

import { CartItemRow } from "./cart-item-row";
import { cartTotals, groupByShop } from "./cart-utils";

export function CartDrawer() {
  const t = useTranslations("sharedComponents.cartDrawer");
  const [open, setOpen] = useState(false);
  // Closed, the drawer shows one number, and that comes with the header's
  // other badges. The cart itself is fetched when the drawer opens.
  const { cartItems } = useBadges();
  const { items, itemCount, isLoading, updateQuantity, removeItem } = useCart({
    enabled: open,
  });
  const count = open && !isLoading ? itemCount : cartItems;
  const groups = groupByShop(items, t("shopFallback"));
  const totals = cartTotals(items);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="focus-ring relative grid size-11 place-items-center rounded-full"
            // Icon-only: without a name a screen reader announced "button".
            aria-label={t("title", { count })}
          >
            <ShoppingBag className="size-5 text-text-secondary" />
            {count > 0 ? (
              <span className="absolute top-0 right-0 flex size-5 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-text-on-brand">
                {count}
              </span>
            ) : null}
          </button>
        }
      />
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-[420px]"
      >
        <SheetHeader>
          <SheetTitle>{t("title", { count })}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("description")}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          // First open: the rows are on their way. Without this the drawer
          // said "your cart is empty" for a moment before filling in.
          <div className="flex flex-1 flex-col gap-4 px-4" aria-busy="true">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="size-12 text-text-tertiary" />
            <p className="text-body-lg font-semibold! text-text-primary">
              {t("emptyTitle")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<Link href="/shop" onClick={() => setOpen(false)} />}
            >
              {t("browseGear")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
              {groups.map((group) => (
                <div key={group.shopId} className="flex flex-col gap-3">
                  <span className="text-body-sm font-semibold! text-text-tertiary">
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
                <span className="text-text-secondary">{t("subtotal")}</span>
                <span className="font-semibold text-text-primary">
                  {formatCurrency(totals.subtotal)}
                </span>
              </div>
              {totals.deposits > 0 ? (
                <div className="flex justify-between text-body-sm">
                  <span className="text-text-secondary">{t("deposits")}</span>
                  <span className="text-text-primary">
                    {formatCurrency(totals.deposits)}
                  </span>
                </div>
              ) : null}
              <p className="text-body-sm text-text-tertiary">
                {t("shippingNote")}
              </p>
              <Button
                variant="accent"
                size="lg"
                className="w-full"
                nativeButton={false}
                render={<Link href="/cart" onClick={() => setOpen(false)} />}
              >
                {t("checkout")}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                {t("continueShopping")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
