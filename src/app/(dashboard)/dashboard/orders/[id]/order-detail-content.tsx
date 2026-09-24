"use client";

import type {
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductImage,
  User,
} from "@prisma/client";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";

type Party = Pick<User, "id" | "name" | "firstName" | "avatar" | "email">;
type OrderDetail = Order & {
  customer: Party;
  shop: Party;
  // Only present once the shop has confirmed a collection order — see
  // getOrderDetail's PICKUP_ADDRESS_VISIBLE_IN.
  pickupAddress: string | null;
  reviewableItems: { productId: string; name: string }[];
  items: (OrderItem & {
    product: Pick<Product, "name" | "type"> & {
      images: Pick<ProductImage, "url">[];
    };
  })[];
};

const STATUS_VARIANT: Record<
  OrderStatus,
  "warning" | "success" | "neutral" | "destructive"
> = {
  PENDING: "warning",
  CONFIRMED: "success",
  SHIPPED: "success",
  DELIVERED: "neutral",
  PICKED_UP: "success",
  OVERDUE: "destructive",
  CANCELLED: "destructive",
  RETURNED: "neutral",
};

const STEPS: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];

export function OrderDetailContent() {
  const t = useTranslations("dashboardCore.orderDetail");
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = () => {
    fetch(`/api/orders/${params.id}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          if (body.data) setOrder(body.data);
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    load();
    // `load` is a fresh closure every render but only truly depends on
    // params.id — re-fetches exactly when navigating to a different order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const updateStatus = async (
    status: OrderStatus,
    extra?: Record<string, string>,
  ) => {
    setBusy(true);
    await fetch(`/api/orders/${params.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    });
    setBusy(false);
    setTrackingOpen(false);
    setCancelOpen(false);
    setIsLoading(true);
    load();
  };

  const returnRental = async (deductDeposit: boolean) => {
    setBusy(true);
    await fetch(`/api/orders/${params.id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deductDeposit }),
    });
    setBusy(false);
    setIsLoading(true);
    load();
  };

  if (isLoading || !order) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  const isShop = session?.user?.id === order.shopId;
  const variant = STATUS_VARIANT[order.status];
  const stepIndex = STEPS.indexOf(order.status);
  // A collection order is never "shipped": the same two statuses read as
  // ready-for-pickup / collected, and there is no carrier to enter.
  const isPickup = order.deliveryMethod === "PICKUP";
  const statusLabel = (status: OrderStatus) =>
    isPickup && (status === "SHIPPED" || status === "DELIVERED")
      ? t(`pickupStatus.${status}`)
      : t(`status.${status}`);
  const hasRental = order.items.some((i) => i.type === "RENT");

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={isShop ? "/dashboard/shop-orders" : "/dashboard/orders"}
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold! text-text-secondary"
      >
        <ArrowLeft className="size-4" />
        {t("backToOrders")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-display-md text-text-primary">
          {t("orderNumber", { id: order.id.slice(-8) })}
        </h1>
        <Badge variant={variant}>{statusLabel(order.status)}</Badge>
      </div>

      {order.status !== "CANCELLED" && order.status !== "RETURNED" ? (
        // Each step is named: bare "1 — 2 — 3 — 4" told neither side what
        // the order was waiting for (24/09 audit).
        <ol className="flex items-start gap-2">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="flex flex-1 items-start last:flex-none"
              aria-current={index === stepIndex ? "step" : undefined}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex size-7 items-center justify-center rounded-full text-body-sm font-bold ${
                    index <= stepIndex
                      ? "bg-brand-primary text-text-on-brand"
                      : "bg-bg-sunken text-text-tertiary"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-center text-caption whitespace-nowrap ${
                    index <= stepIndex
                      ? "text-text-primary"
                      : "text-text-tertiary"
                  }`}
                >
                  {statusLabel(step)}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <div
                  className={`mx-1.5 mt-3.5 h-px flex-1 ${index < stepIndex ? "bg-brand-primary" : "bg-bg-sunken"}`}
                />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card
            padding={false}
            className="flex flex-col divide-y divide-border-subtle"
          >
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex flex-col">
                  <span className="text-body-md font-semibold! text-text-primary">
                    {item.product.name} x{item.quantity}
                  </span>
                  {item.type === "RENT" ? (
                    <span className="text-body-sm text-text-secondary">
                      {t("rentalLabel")}{" "}
                      {item.rentalStart ? formatDate(item.rentalStart) : ""} –{" "}
                      {item.rentalEnd ? formatDate(item.rentalEnd) : ""}
                      {item.depositAmount
                        ? ` · ${t("depositLabel", { amount: formatCurrency(item.depositAmount, order.currency), status: item.depositStatus ?? "HELD" })}`
                        : ""}
                    </span>
                  ) : null}
                </div>
                <span className="text-body-md text-text-primary">
                  {formatCurrency(
                    item.unitPrice * item.quantity,
                    order.currency,
                  )}
                </span>
              </div>
            ))}
          </Card>

          {order.reviewableItems.length > 0 ? (
            <Card className="flex flex-col gap-3">
              <span className="text-body-md font-semibold! text-text-primary">
                {t("reviewTitle")}
              </span>
              {order.reviewableItems.map((item) => (
                <ProductReviewForm
                  key={item.productId}
                  orderId={order.id}
                  productId={item.productId}
                  name={item.name}
                  onDone={load}
                />
              ))}
            </Card>
          ) : null}

          {/* Neither side could see whether the buyer chose delivery or
              collection until an address appeared (24/09 audit). */}
          {order.deliveryMethod === "SHIP" ||
          order.deliveryMethod === "PICKUP" ? (
            <Card className="flex flex-col gap-1.5">
              <span className="text-body-sm text-text-tertiary">
                {t("deliveryMethodLabel")}
              </span>
              <p className="text-body-md text-text-primary">
                {t(`deliveryMethod.${order.deliveryMethod}`)}
              </p>
            </Card>
          ) : null}

          {order.pickupAddress ? (
            <Card className="flex flex-col gap-1.5">
              <span className="text-body-sm text-text-tertiary">
                {t("pickupAddress")}
              </span>
              <p className="text-body-md text-text-primary">
                {order.pickupAddress}
              </p>
            </Card>
          ) : null}

          {order.deliveryFee ? (
            <Card className="flex flex-row items-center justify-between gap-1.5">
              <span className="text-body-sm text-text-tertiary">
                {t("deliveryFee")}
              </span>
              <p className="text-body-md text-text-primary">
                {formatCurrency(order.deliveryFee, order.currency)}
              </p>
            </Card>
          ) : null}

          {order.shippingAddress ? (
            <Card className="flex flex-col gap-1.5">
              <span className="text-body-sm text-text-tertiary">
                {t("shippingAddress")}
              </span>
              <p className="text-body-md text-text-primary">
                {order.shippingAddress}
              </p>
            </Card>
          ) : null}

          {order.trackingNumber ? (
            <Card className="flex flex-col gap-1.5">
              <span className="text-body-sm text-text-tertiary">
                {t("tracking")}
              </span>
              <p className="text-body-md text-text-primary">
                {order.trackingCarrier} — {order.trackingNumber}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3 pb-2">
              <span className="text-body-md font-semibold! text-text-primary">
                {isShop
                  ? (order.customer.firstName ?? order.customer.name)
                  : (order.shop.firstName ?? order.shop.name)}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              nativeButton={false}
              render={
                <Link
                  href={`/dashboard/messages?to=${isShop ? order.customerId : order.shopId}`}
                />
              }
            >
              {isShop ? t("messageParty.customer") : t("messageParty.shop")}
            </Button>

            {isShop && order.status === "PENDING" ? (
              <Button
                variant="accent"
                disabled={busy}
                onClick={() => updateStatus("CONFIRMED")}
              >
                {t("confirmOrder")}
              </Button>
            ) : null}
            {isShop && order.status === "CONFIRMED" ? (
              <Button
                variant="accent"
                disabled={busy}
                onClick={() =>
                  isPickup ? updateStatus("SHIPPED") : setTrackingOpen(true)
                }
              >
                {isPickup ? t("markReadyForPickup") : t("markAsShipped")}
              </Button>
            ) : null}
            {isShop && order.status === "SHIPPED" ? (
              <Button
                variant="accent"
                disabled={busy}
                onClick={() => updateStatus("DELIVERED")}
              >
                {isPickup ? t("markPickedUpByBuyer") : t("markAsDelivered")}
              </Button>
            ) : null}
            {isShop && hasRental && order.status === "DELIVERED" ? (
              <>
                <Button
                  variant="accent"
                  disabled={busy}
                  onClick={() => returnRental(false)}
                >
                  {t("refundDeposit")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => returnRental(true)}
                >
                  {t("deductDeposit")}
                </Button>
              </>
            ) : null}
            {order.status === "PENDING" || order.status === "CONFIRMED" ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
              >
                {t("cancelOrder")}
              </Button>
            ) : null}
          </Card>

          <Card className="flex flex-row justify-between">
            <span className="text-body-sm text-text-tertiary">
              {t("total")}
            </span>
            <span className="text-heading-sm font-bold! text-text-primary">
              {formatCurrency(order.totalPrice, order.currency)}
            </span>
          </Card>
        </div>
      </div>

      <Dialog open={trackingOpen} onOpenChange={setTrackingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("markAsShipped")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              label={t("carrier")}
              value={trackingCarrier}
              onChange={(e) => setTrackingCarrier(e.target.value)}
            />
            <Input
              label={t("trackingNumber")}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTrackingOpen(false)}>
              {t("dialogCancel")}
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() =>
                updateStatus("SHIPPED", { trackingNumber, trackingCarrier })
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("markAsShipped")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-text-secondary">
              {t("cancelDialog.body")}
            </p>
            <Textarea
              placeholder={t("cancelDialog.reasonPlaceholder")}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              {t("cancelDialog.keepOrder")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => updateStatus("CANCELLED", { cancelReason })}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("cancelOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * One product's review form. Kept inline rather than in its own file: it is
 * only ever rendered here, and it is the order screen that knows which items
 * are eligible (services/product-reviews.ts decides that server-side).
 */
function ProductReviewForm({
  orderId,
  productId,
  name,
  onDone,
}: {
  orderId: string;
  productId: string;
  name: string;
  onDone: () => void;
}) {
  const t = useTranslations("dashboardCore.orderDetail");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/product-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        productId,
        rating,
        content: content || undefined,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.message ?? t("reviewFailed"));
      return;
    }
    toast.add({ title: t("reviewSubmitted"), type: "success" });
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 rounded-[var(--fg-radius-sm)] border border-border-default p-3">
      <span className="text-body-sm text-text-secondary">
        {t("reviewPrompt", { name })}
      </span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${t("ratingLabel")} ${value}`}
            onClick={() => setRating(value)}
            className={
              value <= rating ? "text-brand-primary" : "text-text-tertiary"
            }
          >
            <Star className="size-5" />
          </button>
        ))}
      </div>
      <Textarea
        aria-label={t("commentLabel")}
        placeholder={t("commentLabel")}
        rows={3}
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <Button variant="accent" size="sm" disabled={busy} onClick={submit}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("reviewSubmit")}
      </Button>
    </div>
  );
}
