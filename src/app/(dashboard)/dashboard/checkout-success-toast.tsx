"use client";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { toast } from "@/components/ui/toast";

// Stripe redirects here right after checkout, but the roles/subscription
// only become real once the checkout.session.completed webhook lands — so
// this polls briefly rather than assuming activation is instant.
export function CheckoutSuccessToast() {
  const t = useTranslations("dashboardCore.checkoutSuccessToast");
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success" || handled.current) return;
    handled.current = true;

    toast.add({ title: t("welcome"), type: "success" });
    router.replace("/dashboard");

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const res = await fetch("/api/users/me");
      const body = await res.json();
      const hasActiveRole = body?.data?.roles?.length > 1; // more than just CUSTOMER

      if (hasActiveRole || attempts >= 10) {
        clearInterval(interval);
        if (hasActiveRole) router.refresh();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [searchParams, router, t]);

  return null;
}
