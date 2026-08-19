"use client";

import type { Order, OrderItem, OrderStatus, Product, User } from "@prisma/client";
import { Package } from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

type OrderRow = Order & {
  customer: Pick<User, "id" | "name" | "firstName" | "avatar">;
  items: (OrderItem & { product: Pick<Product, "name"> })[];
};

const TABS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "New" },
  { value: "CONFIRMED", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_BADGE: Record<OrderStatus, { label: string; variant: "warning" | "success" | "neutral" | "destructive" }> = {
  PENDING: { label: "New", variant: "warning" },
  CONFIRMED: { label: "Processing", variant: "success" },
  SHIPPED: { label: "Shipped", variant: "success" },
  DELIVERED: { label: "Completed", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  RETURNED: { label: "Returned", variant: "neutral" },
};

function partyName(party: Pick<User, "name" | "firstName">) {
  return party.firstName ?? party.name ?? "Customer";
}

export default function ShopOrdersPage() {
  const [tab, setTab] = useState<OrderStatus | "ALL">("ALL");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    startTransition(() => setIsLoading(true));
    fetch(`/api/orders?role=shop${tab !== "ALL" ? `&status=${tab}` : ""}`)
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
      <h1 className="text-display-md text-text-primary">Shop orders</h1>

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
        </Card>
      ) : (
        <Card padding={false}>
          <div className="grid grid-cols-[1.2fr_1.6fr_0.9fr_0.9fr_0.9fr_auto] items-center border-b border-border-subtle px-5 py-3.5 text-caption-upper tracking-[0.06em] text-text-tertiary">
            <span>Customer</span>
            <span>Items</span>
            <span>Total</span>
            <span>Date</span>
            <span>Status</span>
            <span />
          </div>
          {orders.map((order) => {
            const status = STATUS_BADGE[order.status];
            return (
              <div
                key={order.id}
                className="grid grid-cols-[1.2fr_1.6fr_0.9fr_0.9fr_0.9fr_auto] items-center border-b border-border-subtle px-5 py-4 text-body-md last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    {order.customer.avatar ? <AvatarImage src={order.customer.avatar} alt="" /> : null}
                    <AvatarFallback>{partyName(order.customer)[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-text-primary">{partyName(order.customer)}</span>
                </div>
                <span className="truncate text-text-secondary">
                  {order.items.map((i) => `${i.product.name} x${i.quantity}`).join(", ")}
                </span>
                <span className="font-semibold text-text-primary">
                  {formatCurrency(order.totalPrice, order.currency)}
                </span>
                <span className="text-text-secondary">
                  {new Date(order.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
                <Badge variant={status.variant}>{status.label}</Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  nativeButton={false}
                  render={<Link href={`/dashboard/orders/${order.id}`} />}
                >
                  View
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
