"use client";

import { CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface OrderSummary {
  id: string;
  totalPrice: number;
  currency: string;
  createdAt: string;
  items: { product: { name: string } }[];
}

export default function CheckoutSuccessPage() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (orders && orders.length > 0) return;
    if (attempts >= 12) return;

    const timeout = setTimeout(async () => {
      const res = await fetch("/api/orders?role=customer&page=1");
      const body = await res.json();
      const recent = (body.data ?? []).filter(
        (o: OrderSummary) => Date.now() - new Date(o.createdAt).getTime() < 5 * 60 * 1000,
      );
      if (recent.length > 0) {
        setOrders(recent);
      } else {
        setAttempts((a) => a + 1);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [attempts, orders]);

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      {!orders ? (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">Setting up your order...</p>
          <p className="text-body-md text-text-secondary">This only takes a moment.</p>
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="size-16 text-success" />
          <h1 className="text-display-sm text-text-primary">Order confirmed!</h1>
          {orders.map((order) => (
            <div key={order.id} className="text-body-md text-text-secondary">
              Order #{order.id.slice(-8)} — {order.items.map((i) => i.product.name).join(", ")}
            </div>
          ))}
          <p className="text-body-sm text-text-tertiary">
            The shop will confirm your order shortly. You&apos;ll get an email with updates.
          </p>
          <div className="flex gap-3">
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href={`/dashboard/orders/${orders[0].id}`} />}
            >
              View order
            </Button>
            <Button variant="ghost" nativeButton={false} render={<Link href="/shop" />}>
              Continue shopping
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
