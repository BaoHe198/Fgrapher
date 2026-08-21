"use client";

import type { Role } from "@prisma/client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/constants";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = roles.reduce((sum, role) => sum + (rolePrices[role] ?? 0), 0);
  const suffix = interval === "year" ? "/yr" : "/mo";
  const heading =
    roles.length === 1
      ? `Activate your ${ROLE_LABELS[roles[0]]} profile`
      : `Activate your ${roles.length} profiles`;

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
          ? "Payments aren't set up in this environment yet — your role stays inactive until then. You can keep exploring the rest of the dashboard in the meantime."
          : (body.message ?? "Something went wrong. Please try again."),
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
          <p className="text-body-md text-text-secondary">
            Start a 14-day free trial — cancel anytime before it ends and you won&apos;t be
            charged.
          </p>
          {interval === "year" ? (
            <span className="mx-auto w-fit rounded-full bg-success-bg px-2.5 py-1 text-body-sm font-bold text-success">
              Billed yearly — save 20%
            </span>
          ) : null}
        </div>

        {cancelled ? (
          <Alert>
            <AlertDescription>Checkout was cancelled — no charge was made.</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="flex flex-col divide-y divide-border-subtle" padding={false}>
          {roles.map((role) => (
            <div key={role} className="flex items-center justify-between px-5 py-3.5">
              <span className="text-body-md text-text-primary">{ROLE_LABELS[role]}</span>
              <span className="text-body-md font-semibold text-text-primary">
                {formatCurrency(rolePrices[role] ?? 0, "VND")}
                {suffix}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-body-md font-semibold text-text-primary">Total</span>
            <span className="text-heading-md font-bold text-text-primary">
              {formatCurrency(total, "VND")}
              {suffix}
            </span>
          </div>
        </Card>

        <p className="text-center text-body-sm text-text-tertiary">
          Free for 14 days, then {formatCurrency(total, "VND")}
          {suffix === "/yr" ? "/year" : "/month"}
        </p>

        <div className="flex flex-col gap-2.5">
          <Button variant="accent" size="lg" disabled={isSubmitting} onClick={onStartTrial}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Start free trial
          </Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/dashboard" />}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
