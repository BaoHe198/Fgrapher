"use client";

import type { Role } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function BillingOnboardingContent({
  roles,
  cancelled,
  rolePrices,
  interval,
}: {
  roles: Role[];
  cancelled: boolean;
  rolePrices: Partial<Record<Role, number>>;
  interval: "month" | "year";
}) {
  const t = useTranslations("accountFlows.onboarding.billing");
  const roleT = useTranslations("role");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = roles.reduce((sum, role) => sum + (rolePrices[role] ?? 0), 0);
  const suffix =
    interval === "year" ? `/${t("yearAbbrev")}` : `/${t("monthAbbrev")}`;
  const heading =
    roles.length === 1
      ? t("headingSingle", { role: roleT(roles[0]) })
      : t("headingPlural", { count: roles.length });

  const onStartTrial = async () => {
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles, interval }),
    });
    const body = await res.json();

    if (!res.ok || !body.data?.url) {
      setError(
        body.error === "not_configured"
          ? t("notConfiguredError")
          : (body.message ?? t("genericError")),
      );
      setIsSubmitting(false);
      return;
    }

    window.location.href = body.data.url;
  };

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-display-md text-text-primary">{heading}</h1>
          <p className="text-body-md text-text-secondary">{t("subtitle")}</p>
          {interval === "year" ? (
            <span className="mx-auto w-fit rounded-full bg-success-bg px-2.5 py-1 text-body-sm font-bold text-success">
              {t("billedYearlyBadge")}
            </span>
          ) : null}
        </div>

        {cancelled ? (
          <Alert>
            <AlertDescription>{t("checkoutCancelled")}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card
          className="flex flex-col divide-y divide-border-subtle"
          padding={false}
        >
          {roles.map((role) => (
            <div
              key={role}
              className="flex items-center justify-between px-5 py-3.5"
            >
              <span className="text-body-md text-text-primary">
                {roleT(role)}
              </span>
              <span className="text-body-md font-semibold text-text-primary">
                {formatCurrency(rolePrices[role] ?? 0, "VND")}
                {suffix}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-body-md font-semibold text-text-primary">
              {t("total")}
            </span>
            <span className="text-heading-md font-bold text-text-primary">
              {formatCurrency(total, "VND")}
              {suffix}
            </span>
          </div>
        </Card>

        <p className="text-center text-body-sm text-text-tertiary">
          {t("freeTrialNote", {
            amount: `${formatCurrency(total, "VND")}${suffix}`,
          })}
        </p>

        <div className="flex flex-col gap-2.5">
          <Button
            variant="accent"
            size="lg"
            disabled={isSubmitting}
            onClick={onStartTrial}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("startTrial")}
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            {t("skipForNow")}
          </Button>
        </div>
      </div>
    </div>
  );
}
