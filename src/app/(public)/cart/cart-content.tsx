"use client";

import { Loader2, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CartItemRow } from "@/components/cart/cart-item-row";
import { cartTotals, groupByShop } from "@/components/cart/cart-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/utils";

export function CartContent() {
  const t = useTranslations("publicPages.cart");
  const router = useRouter();
  const { items, isLoading, updateQuantity, removeItem } = useCart();
  const groups = groupByShop(items);
  const totals = cartTotals(items);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
        <ShoppingBag className="size-14 text-text-tertiary" />
        <h1 className="text-heading-xl text-text-primary">
          {t("empty.heading")}
        </h1>
        <Button
          variant="accent"
          nativeButton={false}
          render={<Link href="/shop" />}
        >
          {t("empty.browseGear")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-display-md text-text-primary">{t("heading")}</h1>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <Card key={group.shopId} className="flex flex-col gap-4">
              <span className="text-body-md font-semibold! text-text-primary">
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
            </Card>
          ))}
        </div>

        <Card className="sticky top-[104px] flex flex-col gap-3">
          <span className="text-heading-sm text-text-primary">
            {t("orderSummary")}
          </span>
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
          <div className="flex justify-between border-t border-border-subtle pt-3 text-heading-sm font-bold! text-text-primary">
            <span>{t("total")}</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
          <p className="text-body-sm text-text-tertiary">{t("shippingNote")}</p>
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => router.push("/checkout")}
          >
            {t("checkoutBtn")}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            nativeButton={false}
            render={<Link href="/shop" />}
          >
            {t("continueShopping")}
          </Button>
        </Card>
      </div>
    </div>
  );
}
