"use client";

import { CheckCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

export function CheckoutSuccessContent() {
  const t = useTranslations("publicPages.checkoutSuccess");
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (orders && orders.length > 0) return;
    if (attempts >= 12) return;

    const timeout = setTimeout(async () => {
      const res = await fetch("/api/orders?role=customer&page=1");
      const body = await res.json();
      const recent = (body.data ?? []).filter(
        (o: OrderSummary) =>
          Date.now() - new Date(o.createdAt).getTime() < 5 * 60 * 1000,
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
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("settingUp")}
          </p>
          <p className="text-body-md text-text-secondary">{t("momentNote")}</p>
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="size-16 text-success" />
          <h1 className="text-display-sm text-text-primary">
            {t("orderConfirmed")}
          </h1>
          {orders.map((order) => (
            <div key={order.id} className="text-body-md text-text-secondary">
              {t("orderLine", {
                orderId: order.id.slice(-8),
                items: order.items.map((i) => i.product.name).join(", "),
              })}
            </div>
          ))}
          <p className="text-body-sm text-text-tertiary">
            {t("shopWillConfirm")}
          </p>
          <div className="flex gap-3">
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href={`/dashboard/orders/${orders[0].id}`} />}
            >
              {t("viewOrder")}
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/shop" />}
            >
              {t("continueShopping")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
