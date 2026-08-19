"use client";

import type { Order, OrderItem, OrderStatus, Product, ProductImage, User } from "@prisma/client";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";

type Party = Pick<User, "id" | "name" | "firstName" | "avatar" | "email">;
type OrderDetail = Order & {
  customer: Party;
  shop: Party;
  items: (OrderItem & { product: Pick<Product, "name" | "type"> & { images: Pick<ProductImage, "url">[] } })[];
};

const STATUS_BADGE: Record<OrderStatus, { label: string; variant: "warning" | "success" | "neutral" | "destructive" }> = {
  PENDING: { label: "Processing", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  SHIPPED: { label: "Shipped", variant: "success" },
  DELIVERED: { label: "Delivered", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  RETURNED: { label: "Returned", variant: "neutral" },
};

const STEPS: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];

export default function OrderDetailPage() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const updateStatus = async (status: OrderStatus, extra?: Record<string, string>) => {
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
  const status = STATUS_BADGE[order.status];
  const stepIndex = STEPS.indexOf(order.status);
  const hasRental = order.items.some((i) => i.type === "RENT");

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={isShop ? "/dashboard/shop-orders" : "/dashboard/orders"}
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold text-text-secondary"
      >
        <ArrowLeft className="size-4" />
        Back to orders
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-display-md text-text-primary">Order #{order.id.slice(-8)}</h1>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {order.status !== "CANCELLED" && order.status !== "RETURNED" ? (
        <div className="flex items-center gap-2">
          {STEPS.map((step, index) => (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-body-sm font-bold ${
                  index <= stepIndex ? "bg-brand-primary text-text-on-brand" : "bg-bg-sunken text-text-tertiary"
                }`}
              >
                {index + 1}
              </div>
              {index < STEPS.length - 1 ? (
                <div className={`mx-1.5 h-px flex-1 ${index < stepIndex ? "bg-brand-primary" : "bg-bg-sunken"}`} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card padding={false} className="flex flex-col divide-y divide-border-subtle">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex flex-col">
                  <span className="text-body-md font-semibold text-text-primary">
                    {item.product.name} x{item.quantity}
                  </span>
                  {item.type === "RENT" ? (
                    <span className="text-body-sm text-text-secondary">
                      Rental: {item.rentalStart ? new Date(item.rentalStart).toLocaleDateString("en-US", { timeZone: "UTC" }) : ""} –{" "}
                      {item.rentalEnd ? new Date(item.rentalEnd).toLocaleDateString("en-US", { timeZone: "UTC" }) : ""}
                      {item.depositAmount ? ` · Deposit ${formatCurrency(item.depositAmount, order.currency)} (${item.depositStatus ?? "HELD"})` : ""}
                    </span>
                  ) : null}
                </div>
                <span className="text-body-md text-text-primary">
                  {formatCurrency(item.unitPrice * item.quantity, order.currency)}
                </span>
              </div>
            ))}
          </Card>

          {order.shippingAddress ? (
            <Card className="flex flex-col gap-1.5">
              <span className="text-body-sm text-text-tertiary">Shipping address</span>
              <p className="text-body-md text-text-primary">{order.shippingAddress}</p>
            </Card>
          ) : null}

          {order.trackingNumber ? (
            <Card className="flex flex-col gap-1.5">
              <span className="text-body-sm text-text-tertiary">Tracking</span>
              <p className="text-body-md text-text-primary">
                {order.trackingCarrier} — {order.trackingNumber}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3 pb-2">
              <span className="text-body-md font-semibold text-text-primary">
                {isShop ? (order.customer.firstName ?? order.customer.name) : (order.shop.firstName ?? order.shop.name)}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              nativeButton={false}
              render={<Link href={`/dashboard/messages?to=${isShop ? order.customerId : order.shopId}`} />}
            >
              Message {isShop ? "customer" : "shop"}
            </Button>

            {isShop && order.status === "PENDING" ? (
              <Button variant="accent" disabled={busy} onClick={() => updateStatus("CONFIRMED")}>
                Confirm order
              </Button>
            ) : null}
            {isShop && order.status === "CONFIRMED" ? (
              <Button variant="accent" disabled={busy} onClick={() => setTrackingOpen(true)}>
                Mark as shipped
              </Button>
            ) : null}
            {isShop && order.status === "SHIPPED" ? (
              <Button variant="accent" disabled={busy} onClick={() => updateStatus("DELIVERED")}>
                Mark as delivered
              </Button>
            ) : null}
            {isShop && hasRental && order.status === "DELIVERED" ? (
              <>
                <Button variant="accent" disabled={busy} onClick={() => returnRental(false)}>
                  Refund deposit
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => returnRental(true)}>
                  Deduct deposit (damage)
                </Button>
              </>
            ) : null}
            {(order.status === "PENDING" || order.status === "CONFIRMED") ? (
              <Button variant="ghost" disabled={busy} onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            ) : null}
          </Card>

          <Card className="flex justify-between">
            <span className="text-body-sm text-text-tertiary">Total</span>
            <span className="text-heading-sm font-bold text-text-primary">
              {formatCurrency(order.totalPrice, order.currency)}
            </span>
          </Card>
        </div>
      </div>

      <Dialog open={trackingOpen} onOpenChange={setTrackingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as shipped</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              label="Carrier"
              value={trackingCarrier}
              onChange={(e) => setTrackingCarrier(e.target.value)}
            />
            <Input
              label="Tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTrackingOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() => updateStatus("SHIPPED", { trackingNumber, trackingCarrier })}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Mark as shipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-text-secondary">
              Payment will be refunded and stock restored.
            </p>
            <Textarea
              placeholder="Reason (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => updateStatus("CANCELLED", { cancelReason })}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
