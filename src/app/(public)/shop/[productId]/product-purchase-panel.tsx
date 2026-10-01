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

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { toast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";

import { notifyCartChanged } from "@/hooks/use-cart";
import { formatDate } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";
import { vietnamDateKey } from "@/lib/vietnam/date";

const CONDITION_KEY: Record<ProductCondition, string> = {
  NEW: "conditionNew",
  LIKE_NEW: "conditionLikeNew",
  GOOD: "conditionGood",
  FAIR: "conditionFair",
};

// The four levels a seller can state, worst last.
const CONDITION_SCALE: ProductCondition[] = ["FAIR", "GOOD", "LIKE_NEW", "NEW"];

function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

interface Product {
  id: string;
  name: string;
  categoryLabel: string | null;
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
  const categoryLabel = product.categoryLabel;
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saleTotal = (product.price ?? 0) * quantity;
  const today = vietnamDateKey();
  const [rentFrom, setRentFrom] = useState("");
  const [days, setDays] = useState(3);
  const rentTotal = (product.rentalPrice ?? 0) * days;
  const returnDay = rentFrom ? formatDate(addDays(rentFrom, days)) : null;

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
      // "Mua ngay" on something already in the cart up to the shop's stock:
      // the buyer wants to pay for it, not to read that it's already there.
      if (redirectToCheckout && body.code === "alreadyAtStock") {
        router.push("/cart");
        return;
      }
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

  const conditionIndex = CONDITION_SCALE.indexOf(product.condition);

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
          {[
            categoryLabel,
            product.type !== "RENT" ? t("forSale") : null,
            product.type !== "SALE" ? t("rental") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <h1 className="font-display text-[clamp(1.75rem,2.6vw,2.25rem)] leading-[1.08] font-semibold tracking-[-0.02em] text-balance text-text-primary">
          {product.name}
        </h1>
        {shopLocation ? (
          <span className="text-body-sm text-text-secondary">
            {shopLocation}
          </span>
        ) : null}
      </div>

      {/* Condition as the seller states it (wave 2): a scale, not a
          certificate - Fgrapher does not inspect equipment. */}
      <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-dashed border-border-strong p-3">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-body-sm font-semibold! text-text-primary">
            {t(CONDITION_KEY[product.condition])}
          </span>
          <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
            {t("v2.sellerStated")}
          </span>
        </span>
        <span aria-hidden className="grid grid-cols-4 gap-1">
          {CONDITION_SCALE.map((level, index) => (
            <span
              key={level}
              className={cn(
                "h-1.5 rounded-full",
                index <= conditionIndex ? "bg-brand-primary" : "bg-bg-sunken",
              )}
            />
          ))}
        </span>
      </div>

      {product.type === "BOTH" ? (
        <div
          role="radiogroup"
          aria-label={t("v2.mode")}
          className="grid grid-cols-2 gap-1 rounded-full border border-border-default p-1"
        >
          {(["SALE", "RENT"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "focus-ring rounded-full px-3 py-2.5 font-mono text-body-sm tabular-nums transition-colors duration-[var(--fg-dur-150)]",
                mode === m
                  ? "bg-brand-primary font-semibold text-text-on-brand"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {m === "SALE"
                ? `${t("buy")} · ${formatCurrency(product.price ?? 0, product.currency)}`
                : `${t("rent")} · ${formatCurrency(product.rentalPrice ?? 0, product.currency)}/${t("day")}`}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "SALE" ? (
        <>
          <span className="font-mono text-display-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(product.price ?? 0, product.currency)}
          </span>

          {product.stock > 0 ? (
            <span className="text-body-sm text-success">
              {t("inStock", { count: product.stock })}
            </span>
          ) : (
            <span className="w-fit rounded-[4px] border border-dashed border-text-secondary px-2 py-1 font-mono text-meta tracking-[0.12em] text-text-secondary uppercase">
              {t("outOfStock")}
            </span>
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
          <span className="font-mono text-display-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(product.rentalPrice ?? 0, product.currency)}
            <span className="font-sans text-body-sm font-normal text-text-secondary">
              /{t("day")}
            </span>
          </span>

          {isOwner ? (
            ownerActions
          ) : (
            <>
              {/* The rental calculator (wave 2): pick-up day and length;
                  rent, deposit, the total to have ready and the return
                  day follow at once. Rentals are still arranged with the
                  shop by message, which now carries these numbers. */}
              <div className="grid grid-cols-2 gap-3">
                <DateField
                  label={t("v2.pickup")}
                  value={rentFrom}
                  min={today}
                  onChange={setRentFrom}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-body-sm font-semibold! text-text-primary">
                    {t("v2.days")}
                  </span>
                  <div className="flex h-12 items-center justify-between rounded-[var(--fg-radius-md)] border border-border-strong px-1">
                    <button
                      type="button"
                      onClick={() => setDays((d) => Math.max(1, d - 1))}
                      aria-label={t("v2.fewerDays")}
                      className="focus-ring grid size-9 place-items-center rounded-full text-heading-sm"
                    >
                      −
                    </button>
                    <span className="font-mono text-body-lg tabular-nums">
                      {days}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDays((d) => Math.min(60, d + 1))}
                      aria-label={t("v2.moreDays")}
                      className="focus-ring grid size-9 place-items-center rounded-full text-heading-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7, 14].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={days === n}
                    onClick={() => setDays(n)}
                    className={cn(
                      "focus-ring rounded-full border px-3 py-1 text-body-sm",
                      days === n
                        ? "border-brand-primary bg-brand-primary text-text-on-brand"
                        : "border-border-default text-text-primary hover:border-border-strong",
                    )}
                  >
                    {t("v2.dayCount", { count: n })}
                  </button>
                ))}
              </div>
              <dl className="flex flex-col gap-1.5 border-t border-border-subtle pt-3 font-mono text-body-sm tabular-nums">
                <div className="flex justify-between gap-3">
                  <dt className="font-sans text-text-secondary">
                    {t("v2.rentFor", { count: days })}
                  </dt>
                  <dd>{formatCurrency(rentTotal, product.currency)}</dd>
                </div>
                {product.depositAmount ? (
                  <div className="flex justify-between gap-3">
                    <dt className="font-sans text-text-secondary">
                      {t("v2.deposit")}
                    </dt>
                    <dd>
                      {formatCurrency(product.depositAmount, product.currency)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-t border-border-subtle pt-1.5 text-body-md font-semibold">
                  <dt className="font-sans">{t("v2.totalToPrepare")}</dt>
                  <dd>
                    {formatCurrency(
                      rentTotal + (product.depositAmount ?? 0),
                      product.currency,
                    )}
                  </dd>
                </div>
                {returnDay ? (
                  <div className="flex justify-between gap-3 text-text-secondary">
                    <dt className="font-sans">{t("v2.returnOn")}</dt>
                    <dd>{returnDay}</dd>
                  </div>
                ) : null}
              </dl>
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
                    href={`/dashboard/messages?${new URLSearchParams({
                      to: shopId,
                      product: product.id,
                      productName: product.name,
                      ...(rentFrom
                        ? {
                            rentFrom: formatDate(rentFrom),
                            rentDays: String(days),
                          }
                        : {}),
                    }).toString()}`}
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
