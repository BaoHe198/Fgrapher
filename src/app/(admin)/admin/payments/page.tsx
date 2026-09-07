"use client";

import { Loader2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

interface PaymentRow {
  id: string;
  provider: "STRIPE" | "MOMO" | "ZALOPAY" | "BANK_TRANSFER";
  status: "PENDING" | "AWAITING_REVIEW" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  role: string | null;
  interval: string | null;
  amount: number;
  providerOrderId: string | null;
  proofUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    email: string;
  };
}

const PROVIDER_BADGE: Record<PaymentRow["provider"], "accent" | "neutral"> = {
  STRIPE: "neutral",
  MOMO: "accent",
  ZALOPAY: "accent",
  BANK_TRANSFER: "neutral",
};

export default function AdminPaymentsPage() {
  const t = useTranslations("accountFlows.admin.payments");
  const roleT = useTranslations("role");

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reasonNote, setReasonNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    startTransition(() => setIsLoading(true));
    fetch("/api/admin/payments")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setRows(body.data ?? []);
          setIsLoading(false);
        });
      });
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    await fetch(`/api/admin/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "approve"
          ? { action }
          : { action, reason: reasonNote[id]?.trim() || undefined },
      ),
    });
    setBusyId(null);
    toast.add({ title: t("paymentUpdated"), type: "success" });
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("description")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Wallet className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => {
            const isReviewable = row.status === "AWAITING_REVIEW";
            return (
              <Card key={row.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-body-md font-semibold! text-text-primary">
                      {row.user.firstName ?? row.user.name ?? row.user.email}
                    </span>
                    <Badge variant={PROVIDER_BADGE[row.provider]}>
                      {row.provider}
                    </Badge>
                    {row.role ? (
                      <Badge variant="neutral">{roleT(row.role)}</Badge>
                    ) : null}
                  </div>
                  <span className="text-body-md font-semibold! text-text-primary">
                    {formatCurrency(row.amount)}
                  </span>
                </div>

                <p className="text-body-sm text-text-secondary">
                  {row.user.email}
                </p>

                {row.providerOrderId ? (
                  <p className="text-body-sm text-text-tertiary">
                    {t("referenceLabel")}: {row.providerOrderId}
                  </p>
                ) : null}

                {row.proofUrl ? (
                  <a
                    href={row.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit text-body-sm font-semibold! text-brand-primary hover:underline"
                  >
                    {t("viewProof")}
                  </a>
                ) : null}

                {isReviewable ? (
                  <>
                    <Textarea
                      placeholder={t("rejectionNotePlaceholder")}
                      rows={1}
                      value={reasonNote[row.id] ?? ""}
                      onChange={(e) =>
                        setReasonNote((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={busyId === row.id}
                        onClick={() => review(row.id, "approve")}
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === row.id}
                        onClick={() => review(row.id, "reject")}
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  </>
                ) : (
                  // Stale MOMO/ZALOPAY PENDING rows shown for visibility
                  // only — there's no manual-approve path for these
                  // (that would bypass the provider's own signature
                  // verification instead of a bank statement cross-check,
                  // a real security downgrade, not a shortcut worth
                  // offering). They self-resolve via the
                  // expire-payment-intents cron after 24h.
                  <p className="text-body-sm text-text-tertiary">
                    {t("awaitingProviderConfirmation")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
