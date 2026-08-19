"use client";

import type { Order, OrderItem, OrderStatus, Product, ProductImage } from "@prisma/client";
import { Package } from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

type OrderRow = Order & {
  items: (OrderItem & { product: Pick<Product, "name"> & { images: Pick<ProductImage, "url">[] } })[];
};

const TABS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_BADGE: Record<OrderStatus, { label: string; variant: "warning" | "success" | "neutral" | "destructive" }> = {
  PENDING: { label: "Processing", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  SHIPPED: { label: "Shipped", variant: "success" },
  DELIVERED: { label: "Delivered", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  RETURNED: { label: "Returned", variant: "neutral" },
};

export default function CustomerOrdersPage() {
  const [tab, setTab] = useState<OrderStatus | "ALL">("ALL");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    startTransition(() => setIsLoading(true));
    fetch(`/api/orders?role=customer${tab !== "ALL" ? `&status=${tab}` : ""}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setOrders(body.data ?? []);
          setIsLoading(false);
        });
      });
  }, [tab]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">My orders</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as OrderStatus | "ALL")}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTab key={t.value} value={t.value}>
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsPanel key={t.value} value={t.value} />
        ))}
      </Tabs>

      {isLoading ? null : orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Package className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">No orders yet</p>
          <Button variant="secondary" size="sm" nativeButton={false} render={<Link href="/shop" />}>
            Browse gear
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const status = STATUS_BADGE[order.status];
            const preview = order.items.slice(0, 3);
            const extra = order.items.length - preview.length;
            return (
              <Card key={order.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body-md font-semibold text-text-primary">
                    Order #{order.id.slice(-8)} · {new Date(order.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="text-body-sm text-text-secondary">
                  {preview.map((i) => `${i.product.name} x${i.quantity}`).join(", ")}
                  {extra > 0 ? ` +${extra} more` : ""}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-body-md font-semibold text-text-primary">
                    {formatCurrency(order.totalPrice, order.currency)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    nativeButton={false}
                    render={<Link href={`/dashboard/orders/${order.id}`} />}
                  >
                    View details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
