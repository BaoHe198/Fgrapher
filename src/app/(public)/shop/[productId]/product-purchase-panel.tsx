"use client";

import type { ProductCondition, ProductType } from "@prisma/client";
import {
  Loader2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Shield,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";

import { notifyCartChanged } from "@/hooks/use-cart";
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

export function ProductPurchasePanel({
  product,
  shopId,
  shopLocation,
  isOwner,
}: {
  product: Product;
  shopId: string;
  shopLocation: string | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"SALE" | "RENT">(
    product.type === "RENT" ? "RENT" : "SALE",
  );
  const t = useTranslations("publicPages.productDetail");
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saleTotal = (product.price ?? 0) * quantity;

  // The shop looking at its own listing: buying, renting or messaging would
  // only fail ("You can't message yourself" / own-cart), so offer the one
  // thing it can do here.
  const ownerActions = (
    <>
      <p className="text-body-sm text-text-secondary">{t("ownProductNote")}</p>
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        nativeButton={false}
        render={<Link href={`/dashboard/listings/${product.id}/edit`} />}
      >
        <Pencil className="size-4" />
        {t("editOwnProduct")}
      </Button>
    </>
  );

  const addToCart = async (redirectToCheckout: boolean) => {
    setError(null);
    setIsSubmitting(true);
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        quantity: mode === "SALE" ? quantity : 1,
        type: mode,
      }),
    });
    const body = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(body.message ?? t("addFailed"));
      return;
    }
    notifyCartChanged();

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
              {t("inStock", { count: product.stock })}
            </Badge>
          ) : (
            <Badge variant="destructive" className="w-fit">
              {t("outOfStock")}
            </Badge>
          )}

          {/* Out of stock, this used to keep the whole purchase UI — a
              quantity stepper, a running total, then two disabled buttons
              with nothing saying why. Someone could set a quantity, read a
              total and then find nothing would press. What they can
              actually do is ask the shop, so that is what's offered. */}
          {isOwner ? (
            ownerActions
          ) : product.stock === 0 ? (
            <>
              <p className="text-body-sm text-text-secondary">
                {t("outOfStockHelp")}
              </p>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                nativeButton={false}
                render={<Link href={`/dashboard/messages?to=${shopId}`} />}
              >
                <MessageCircle className="size-4" />
                {t("askShop")}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label={t("decreaseQuantity")}
                  className="flex size-9 items-center justify-center rounded-full border border-border-default"
                >
                  −
                </button>
                <span className="w-6 text-center text-body-md font-semibold!">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(product.stock, q + 1))
                  }
                  aria-label={t("increaseQuantity")}
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

              {error ? (
                <p className="text-body-sm text-danger">{error}</p>
              ) : null}

              <Button
                variant="accent"
                size="lg"
                className="w-full"
                disabled={product.stock === 0 || isSubmitting}
                onClick={() => addToCart(false)}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
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
          )}
        </>
      ) : (
        <>
          <span className="text-display-md text-text-primary">
            {formatCurrency(product.rentalPrice ?? 0, product.currency)}
            <span className="text-body-sm text-text-secondary">
              /{t("day")}
            </span>
          </span>

          {product.depositAmount ? (
            <div className="flex justify-between rounded-[var(--fg-radius-md)] bg-bg-sunken p-3 text-body-sm">
              <span className="text-text-secondary">
                {t("depositReference")}
              </span>
              <span className="font-semibold text-text-primary">
                {formatCurrency(product.depositAmount, product.currency)}
              </span>
            </div>
          ) : null}

          {isOwner ? (
            ownerActions
          ) : (
            <>
              <p className="text-body-sm text-text-secondary">
                {t("rentalMessageHelp")}
              </p>

              <Button
                variant="accent"
                size="lg"
                className="w-full"
                nativeButton={false}
                render={
                  <Link
                    href={`/dashboard/messages?to=${shopId}&product=${product.id}&productName=${encodeURIComponent(product.name)}`}
                  />
                }
              >
                <MessageCircle className="size-4" />
                {t("messageToRent")}
              </Button>
            </>
          )}
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
