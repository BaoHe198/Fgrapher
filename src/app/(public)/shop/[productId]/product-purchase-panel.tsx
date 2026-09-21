"use client";

import type { ProductCondition, ProductType } from "@prisma/client";
import { Loader2, RotateCcw, Shield, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { toast } from "@/components/ui/toast";
import { calculateRentalDays } from "@/lib/pricing";
import { useTranslations } from "next-intl";

import { formatCurrency } from "@/lib/utils";

const CONDITION_KEY: Record<ProductCondition, string> = {
  NEW: "conditionNew",
  LIKE_NEW: "conditionLikeNew",
  GOOD: "conditionGood",
  FAIR: "conditionFair",
};

interface Product {
  id: string;
  name: string;
  type: ProductType;
  price: number | null;
  rentalPrice: number | null;
  depositAmount: number | null;
  currency: string;
  condition: ProductCondition;
  stock: number;
}

function todayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function ProductPurchasePanel({
  product,
  shopLocation,
}: {
  product: Product;
  shopLocation: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"SALE" | "RENT">(
    product.type === "RENT" ? "RENT" : "SALE",
  );
  const t = useTranslations("publicPages.productDetail");
  const [quantity, setQuantity] = useState(1);
  const [rentalStart, setRentalStart] = useState("");
  const [rentalEnd, setRentalEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Floor of 0, not 1 — before both dates are picked (or if they're equal)
  // this is a live pre-purchase preview, and should show ₫0 rather than
  // charge for a day the user hasn't actually selected yet. The real order
  // (services/orders.ts) floors at 1, as it must once a purchase is real.
  const rentalDays =
    rentalStart && rentalEnd
      ? Math.max(0, calculateRentalDays(rentalStart, rentalEnd))
      : 0;
  const rentalSubtotal = rentalDays * (product.rentalPrice ?? 0);
  const saleTotal = (product.price ?? 0) * quantity;

  const addToCart = async (redirectToCheckout: boolean) => {
    setError(null);
    if (mode === "RENT" && (!rentalStart || !rentalEnd || rentalDays <= 0)) {
      setError(t("invalidDates"));
      return;
    }

    setIsSubmitting(true);
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        quantity: mode === "SALE" ? quantity : 1,
        type: mode,
        rentalStart: mode === "RENT" ? rentalStart : undefined,
        rentalEnd: mode === "RENT" ? rentalEnd : undefined,
      }),
    });
    const body = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(body.message ?? t("addFailed"));
      return;
    }

    if (redirectToCheckout) {
      router.push("/cart");
    } else {
      toast.add({ title: t("addedToCart"), type: "success" });
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {product.type !== "RENT" ? (
          <Badge variant="neutral">{t("forSale")}</Badge>
        ) : null}
        {product.type !== "SALE" ? (
          <Badge variant="accent">{t("rental")}</Badge>
        ) : null}
      </div>

      <h1 className="text-display-sm text-text-primary">{product.name}</h1>
      <Badge variant="neutral" className="w-fit">
        {t(CONDITION_KEY[product.condition])}
      </Badge>

      {product.type === "BOTH" ? (
        <div className="inline-flex w-fit overflow-hidden rounded-full border border-border-subtle">
          {(["SALE", "RENT"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-body-sm font-bold ${
                mode === m
                  ? "bg-brand-primary text-text-on-brand"
                  : "text-text-secondary"
              }`}
            >
              {m === "SALE" ? t("buy") : t("rent")}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "SALE" ? (
        <>
          <span className="text-display-md text-text-primary">
            {formatCurrency(product.price ?? 0, product.currency)}
          </span>

          {product.stock > 0 ? (
            <Badge variant="success" className="w-fit">
              {product.stock} in stock
            </Badge>
          ) : (
            <Badge variant="destructive" className="w-fit">
              {t("outOfStock")}
            </Badge>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex size-9 items-center justify-center rounded-full border border-border-default"
            >
              −
            </button>
            <span className="w-6 text-center text-body-md font-semibold!">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
              className="flex size-9 items-center justify-center rounded-full border border-border-default"
            >
              +
            </button>
          </div>

          <div className="flex justify-between text-body-md">
            <span className="text-text-secondary">{t("total")}</span>
            <span className="font-semibold text-text-primary">
              {formatCurrency(saleTotal, product.currency)}
            </span>
          </div>

          {error ? <p className="text-body-sm text-danger">{error}</p> : null}

          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={product.stock === 0 || isSubmitting}
            onClick={() => addToCart(false)}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("addToCart")}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={product.stock === 0 || isSubmitting}
            onClick={() => addToCart(true)}
          >
            {t("buyNow")}
          </Button>
        </>
      ) : (
        <>
          <span className="text-body-md text-text-primary">
            {formatCurrency(product.rentalPrice ?? 0, product.currency)}
            <span className="text-body-sm text-text-secondary">/day</span>
          </span>

          <div className="flex gap-2">
            <DateField
              label={t("pickupDate")}
              min={todayDateKey()}
              value={rentalStart}
              onChange={setRentalStart}
            />
            <DateField
              label={t("returnDate")}
              min={rentalStart || todayDateKey()}
              value={rentalEnd}
              onChange={setRentalEnd}
            />
          </div>

          {rentalDays > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3 text-body-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  {t("rentalDays", { days: rentalDays })}{" "}
                  {formatCurrency(product.rentalPrice ?? 0, product.currency)}
                </span>
                <span className="text-text-primary">
                  {formatCurrency(rentalSubtotal, product.currency)}
                </span>
              </div>
              {product.depositAmount ? (
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    {t("depositNote")}
                  </span>
                  <span className="text-text-primary">
                    {formatCurrency(product.depositAmount, product.currency)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-heading-sm font-bold! text-text-primary">
                <span>{t("total")}</span>
                <span>
                  {formatCurrency(
                    rentalSubtotal + (product.depositAmount ?? 0),
                    product.currency,
                  )}
                </span>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-body-sm text-danger">{error}</p> : null}

          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => addToCart(false)}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("requestRental")}
          </Button>
        </>
      )}

      <div className="flex flex-col gap-2 border-t border-border-subtle pt-3 text-body-sm text-text-secondary">
        <span className="flex items-center gap-2">
          <Shield className="size-4" /> {t("paymentByShop")}
        </span>
        <span className="flex items-center gap-2">
          <Truck className="size-4" />
          {shopLocation
            ? t("shipsFrom", { location: shopLocation })
            : t("shippingOrPickup")}
        </span>
        <span className="flex items-center gap-2">
          <RotateCcw className="size-4" /> {t("returnPolicyByShop")}
        </span>
      </div>
    </Card>
  );
}
