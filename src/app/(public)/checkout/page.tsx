"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { CartItemRow } from "@/components/cart/cart-item-row";
import { cartTotals, groupByShop } from "@/components/cart/cart-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Radio } from "@/components/ui/radio";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/utils";

export default function CheckoutPage() {
  const { items, isLoading, updateQuantity, removeItem } = useCart();
  const groups = groupByShop(items);
  const totals = cartTotals(items);

  const [deliveryMethod, setDeliveryMethod] = useState<"SHIP" | "PICKUP">("SHIP");
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
          ? "Payments aren't set up in this environment yet."
          : (body.message ?? "Something went wrong. Please try again."),
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
        <p className="text-body-lg font-semibold text-text-primary">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-8">
      <h1 className="mb-6 text-display-md text-text-primary">Checkout</h1>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3">
            <h2 className="text-heading-md text-text-primary">Delivery method</h2>
            <Radio
              label="Ship to me"
              checked={deliveryMethod === "SHIP"}
              onChange={() => setDeliveryMethod("SHIP")}
            />
            <Radio
              label="Pick up at shop"
              checked={deliveryMethod === "PICKUP"}
              onChange={() => setDeliveryMethod("PICKUP")}
            />
            {deliveryMethod === "SHIP" ? (
              <p className="text-body-sm text-text-tertiary">
                You&apos;ll enter your shipping address on the next step.
              </p>
            ) : (
              <p className="text-body-sm text-text-tertiary">
                Contact the shop after your order is confirmed to arrange pickup.
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <h2 className="text-heading-md text-text-primary">Review your order</h2>
            {groups.map((group) => (
              <Card key={group.shopId} className="flex flex-col gap-4">
                <span className="text-body-md font-semibold text-text-primary">{group.shopName}</span>
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
            label="I agree to the terms of sale/rental"
          />
        </div>

        <Card className="sticky top-[104px] flex flex-col gap-3">
          <span className="text-heading-sm text-text-primary">Order summary</span>
          <div className="flex justify-between text-body-md">
            <span className="text-text-secondary">Subtotal</span>
            <span className="font-semibold text-text-primary">{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.deposits > 0 ? (
            <div className="flex justify-between text-body-sm">
              <span className="text-text-secondary">Deposits</span>
              <span className="text-text-primary">{formatCurrency(totals.deposits)}</span>
            </div>
          ) : null}
          <p className="text-body-sm text-text-tertiary">Shipping calculated at checkout</p>
          <div className="flex justify-between border-t border-border-subtle pt-3 text-heading-sm font-bold text-text-primary">
            <span>Total</span>
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
            Continue to payment
          </Button>
        </Card>
      </div>
    </div>
  );
}
