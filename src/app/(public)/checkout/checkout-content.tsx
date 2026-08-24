"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CartItemRow } from "@/components/cart/cart-item-row";
import { cartTotals, groupByShop } from "@/components/cart/cart-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Radio } from "@/components/ui/radio";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/utils";

export function CheckoutContent() {
  const t = useTranslations("publicPages.checkout");
  const { items, isLoading, updateQuantity, removeItem } = useCart();
  const groups = groupByShop(items);
  const totals = cartTotals(items);

  const [deliveryMethod, setDeliveryMethod] = useState<"SHIP" | "PICKUP">(
    "SHIP",
  );
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCheckout = async () => {
    setError(null);
    setIsSubmitting(true);
    const res = await fetch("/api/orders/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryMethod }),
    });
    const body = await res.json();
    setIsSubmitting(false);

    if (!res.ok || !body.data?.url) {
      setError(
        body.error === "not_configured"
          ? t("paymentsNotConfigured")
          : (body.message ?? t("genericError")),
      );
      return;
    }

    window.location.href = body.data.url;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-body-lg font-semibold text-text-primary">
          {t("emptyCart")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-display-md text-text-primary">{t("heading")}</h1>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3">
            <h2 className="text-heading-md text-text-primary">
              {t("deliveryMethod.heading")}
            </h2>
            <Radio
              label={t("deliveryMethod.shipToMe")}
              checked={deliveryMethod === "SHIP"}
              onChange={() => setDeliveryMethod("SHIP")}
            />
            <Radio
              label={t("deliveryMethod.pickupAtShop")}
              checked={deliveryMethod === "PICKUP"}
              onChange={() => setDeliveryMethod("PICKUP")}
            />
            {deliveryMethod === "SHIP" ? (
              <p className="text-body-sm text-text-tertiary">
                {t("deliveryMethod.shipNote")}
              </p>
            ) : (
              <p className="text-body-sm text-text-tertiary">
                {t("deliveryMethod.pickupNote")}
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <h2 className="text-heading-md text-text-primary">
              {t("reviewOrder")}
            </h2>
            {groups.map((group) => (
              <Card key={group.shopId} className="flex flex-col gap-4">
                <span className="text-body-md font-semibold text-text-primary">
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

          <Checkbox
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            label={t("agreeTerms")}
          />
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
          <p className="text-body-sm text-text-tertiary">{t("shippingNote")}</p>
          <div className="flex justify-between border-t border-border-subtle pt-3 text-heading-sm font-bold text-text-primary">
            <span>{t("total")}</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>

          {error ? <p className="text-body-sm text-danger">{error}</p> : null}

          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={!agreed || isSubmitting}
            onClick={onCheckout}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("continueToPayment")}
          </Button>
        </Card>
      </div>
    </div>
  );
}
