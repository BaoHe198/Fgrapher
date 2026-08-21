"use client";

import type { Role, SubscriptionStatus } from "@prisma/client";
import { CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
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
import { ROLE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface RoleBilling {
  role: Role;
  active: boolean;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    graceEndsAt: string | null;
    interval: "month" | "year";
  } | null;
}

interface Invoice {
  id: string;
  date: number;
  description: string;
  amount: number;
  currency: string;
  status: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; variant: "success" | "accent" | "warning" | "destructive" }> = {
  ACTIVE: { label: "Active", variant: "success" },
  TRIALING: { label: "Trialing", variant: "accent" },
  PAST_DUE: { label: "Past due", variant: "warning" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  EXPIRED: { label: "Expired", variant: "destructive" },
};

function daysUntil(dateIso: string) {
  return Math.max(0, Math.ceil((new Date(dateIso).getTime() - Date.now()) / 86_400_000));
}

export function BillingSettingsContent({
  roles,
  monthlyPrices,
  yearlyPrices,
}: {
  roles: RoleBilling[];
  monthlyPrices: Partial<Record<Role, number>>;
  yearlyPrices: Partial<Record<Role, number>>;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Role | null>(null);
  const [actionBusy, setActionBusy] = useState<Role | null>(null);

  useEffect(() => {
    fetch("/api/stripe/invoices")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setInvoices(body.data ?? []);
          setInvoicesLoading(false);
        });
      });
  }, []);

  const withSubscription = roles.filter((r) => r.subscription);
  // Yearly subscriptions are normalized to a monthly-equivalent figure so
  // mixed monthly/yearly roles can still be summed into one meaningful total.
  const totalMonthly = withSubscription
    .filter((r) => r.subscription!.status === "ACTIVE" || r.subscription!.status === "TRIALING")
    .reduce((sum, r) => {
      const amount =
        r.subscription!.interval === "year"
          ? (yearlyPrices[r.role] ?? 0) / 12
          : (monthlyPrices[r.role] ?? 0);
      return sum + amount;
    }, 0);

  const openPortal = async () => {
    setPortalError(null);
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await res.json();
    setPortalLoading(false);
    if (!res.ok || !body.data?.url) {
      setPortalError(
        body.error === "not_configured"
          ? "Payments aren't set up in this environment yet."
          : (body.message ?? "Couldn't open the billing portal."),
      );
      return;
    }
    window.location.href = body.data.url;
  };

  const onCancel = async () => {
    if (!cancelTarget) return;
    setActionBusy(cancelTarget);
    await fetch("/api/stripe/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: cancelTarget }),
    });
    setActionBusy(null);
    setCancelTarget(null);
    window.location.reload();
  };

  const onResume = async (role: Role) => {
    setActionBusy(role);
    await fetch("/api/stripe/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setActionBusy(null);
    window.location.reload();
  };

  if (withSubscription.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <CreditCard className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold text-text-primary">No active subscriptions</p>
        <p className="max-w-sm text-body-md text-text-secondary">
          Activate a paid role to get a public profile, bookings, and more.
        </p>
        <Button variant="accent" nativeButton={false} render={<Link href="/dashboard/settings/roles" />}>
          Browse roles
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Current plan
        </span>

        {withSubscription.map(({ role, subscription }) => {
          const status = STATUS_BADGE[subscription!.status];
          const isBusy = actionBusy === role;
          return (
            <Card key={role} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body-md font-semibold text-text-primary">
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {subscription!.interval === "year"
                      ? `${formatCurrency(yearlyPrices[role] ?? 0, "VND")}/yr`
                      : `${formatCurrency(monthlyPrices[role] ?? 0, "VND")}/mo`}
                  </span>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              {subscription!.status === "TRIALING" && subscription!.currentPeriodEnd ? (
                <p className="text-body-sm text-text-secondary">
                  Trial ends in {daysUntil(subscription!.currentPeriodEnd)} days
                </p>
              ) : null}

              {subscription!.cancelAtPeriodEnd && subscription!.currentPeriodEnd ? (
                <div className="flex items-center justify-between rounded-[var(--fg-radius-md)] bg-bg-sunken p-3">
                  <span className="text-body-sm text-text-primary">
                    Cancels on {new Date(subscription!.currentPeriodEnd).toDateString()}
                  </span>
                  <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => onResume(role)}>
                    {isBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                    Resume subscription
                  </Button>
                </div>
              ) : subscription!.currentPeriodEnd ? (
                <p className="text-body-sm text-text-secondary">
                  Renews on {new Date(subscription!.currentPeriodEnd).toDateString()}
                </p>
              ) : null}

              {!subscription!.cancelAtPeriodEnd &&
              (subscription!.status === "ACTIVE" || subscription!.status === "TRIALING") ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-fit"
                  disabled={isBusy}
                  onClick={() => setCancelTarget(role)}
                >
                  Cancel subscription
                </Button>
              ) : null}
            </Card>
          );
        })}

        <Card className="flex items-center justify-between">
          <span className="text-body-md font-semibold text-text-primary">Total monthly cost</span>
          <span className="text-heading-md font-bold text-text-primary">
            {formatCurrency(totalMonthly, "VND")}/mo
          </span>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Payment method
        </span>
        <Card className="flex items-center justify-between">
          <span className="text-body-md text-text-secondary">
            Managed securely through Stripe
          </span>
          <Button size="sm" variant="secondary" disabled={portalLoading} onClick={openPortal}>
            {portalLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            Manage subscription
          </Button>
        </Card>
        {portalError ? <p className="text-body-sm text-danger">{portalError}</p> : null}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Billing history
        </span>
        {invoicesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-text-tertiary" />
          </div>
        ) : invoices.length === 0 ? (
          <Card className="py-8 text-center text-body-md text-text-secondary">
            No invoices yet.
          </Card>
        ) : (
          <Card padding={false}>
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5 last:border-b-0"
              >
                <div className="flex flex-col">
                  <span className="text-body-md text-text-primary">{invoice.description}</span>
                  <span className="text-body-sm text-text-tertiary">
                    {new Date(invoice.date).toDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-body-md font-semibold text-text-primary">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </span>
                  {invoice.hostedUrl ? (
                    <a
                      href={invoice.hostedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-body-sm font-semibold text-brand-primary"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your {cancelTarget ? ROLE_LABELS[cancelTarget] : ""} subscription?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-body-md text-text-secondary">
            <p>Your profile stays live until the end of the current billing period.</p>
            <p>All your data — portfolio, bookings, reviews — is kept, and you can reactivate anytime.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Keep subscription
            </Button>
            <Button variant="destructive" disabled={actionBusy !== null} onClick={onCancel}>
              {actionBusy ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
