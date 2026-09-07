"use client";

import type { PaymentStatus, Role } from "@prisma/client";
import { Banknote, Loader2, Upload, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { compressImageFile } from "@/lib/image-compression";
import { formatCurrency } from "@/lib/utils";

interface RoleBilling {
  role: Role;
  active: boolean;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
  } | null;
}

interface BankTransferInfo {
  accountNumber: string;
  accountName: string;
  bankName: string;
}

interface BankTransferPayment {
  id: string;
  providerOrderId: string | null;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
const UPLOAD_MAX_DIMENSION = 1920;

async function uploadProofFile(file: File): Promise<string> {
  const compressed = await compressImageFile(file, {
    maxBytes: UPLOAD_MAX_BYTES,
    maxDimension: UPLOAD_MAX_DIMENSION,
  });

  const sigRes = await fetch("/api/upload/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose: "payment" }),
  });
  const sigBody = await sigRes.json();
  if (!sigRes.ok) throw new Error(sigBody.message ?? "upload_unavailable");

  const formData = new FormData();
  formData.append("file", compressed);
  formData.append("api_key", sigBody.data.apiKey);
  formData.append("timestamp", String(sigBody.data.timestamp));
  formData.append("signature", sigBody.data.signature);
  formData.append("folder", sigBody.data.folder);
  formData.append("transformation", sigBody.data.transformation);
  formData.append("allowed_formats", sigBody.data.allowedFormats);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sigBody.data.cloudName}/auto/upload`,
    { method: "POST", body: formData },
  );
  const uploadBody = await uploadRes.json();
  if (!uploadRes.ok) throw new Error("upload_failed");
  return uploadBody.secure_url as string;
}

export function LocalPaymentsContent({
  roles,
  monthlyPrices,
  yearlyPrices,
  momoEnabled,
  zalopayEnabled,
  bankTransferEnabled,
}: {
  roles: RoleBilling[];
  monthlyPrices: Partial<Record<Role, number>>;
  yearlyPrices: Partial<Record<Role, number>>;
  momoEnabled: boolean;
  zalopayEnabled: boolean;
  bankTransferEnabled: boolean;
}) {
  const t = useTranslations("dashboardSettings.billing");
  const roleT = useTranslations("role");

  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busyMethod, setBusyMethod] = useState<"momo" | "zalopay" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bankInfo, setBankInfo] = useState<BankTransferInfo | null>(null);
  const [bankSubmissions, setBankSubmissions] = useState<BankTransferPayment[]>(
    [],
  );
  const [activeBankPayment, setActiveBankPayment] =
    useState<BankTransferPayment | null>(null);
  const [bankBusy, setBankBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bankTransferEnabled) return;
    fetch("/api/payments/bank-transfer")
      .then((res) => res.json())
      .then((body) => {
        if (body.data) {
          setBankInfo(body.data.bankInfo);
          setBankSubmissions(body.data.submissions ?? []);
        }
      });
  }, [bankTransferEnabled]);

  if (roles.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Wallet className="size-12 text-text-tertiary" />
        <p className="text-body-lg font-semibold! text-text-primary">
          {t("emptyTitle")}
        </p>
        <p className="max-w-sm text-body-md text-text-secondary">
          {t("emptyDesc")}
        </p>
        <Button
          variant="accent"
          nativeButton={false}
          render={<Link href="/dashboard/settings/roles" />}
        >
          {t("browseRoles")}
        </Button>
      </Card>
    );
  }

  // One-active-paid-role-per-account rule (CLAUDE.md) means this is
  // practically always exactly one entry — kept as a loop for the rare
  // transitional moment (e.g. mid role-change-request) rather than
  // hard-assuming roles[0].
  const role = roles[0].role;
  const amount = interval === "year" ? yearlyPrices[role] : monthlyPrices[role];

  const payWith = async (method: "momo" | "zalopay") => {
    setError(null);
    setBusyMethod(method);
    const res = await fetch(`/api/payments/${method}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, interval }),
    });
    const body = await res.json();
    if (!res.ok || !body.data?.payUrl) {
      setBusyMethod(null);
      setError(body.message ?? t("paymentCreateFailed"));
      return;
    }
    window.location.href = body.data.payUrl;
  };

  const startBankTransfer = async () => {
    setError(null);
    setBankBusy(true);
    const res = await fetch("/api/payments/bank-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, interval }),
    });
    const body = await res.json();
    setBankBusy(false);
    if (!res.ok || !body.data) {
      setError(body.message ?? t("paymentCreateFailed"));
      return;
    }
    setActiveBankPayment(body.data);
  };

  const submitProof = async (file: File) => {
    if (!activeBankPayment) return;
    setError(null);
    setBankBusy(true);
    try {
      const proofUrl = await uploadProofFile(file);
      const res = await fetch("/api/payments/bank-transfer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: activeBankPayment.id, proofUrl }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? t("paymentCreateFailed"));
        return;
      }
      setBankSubmissions((prev) => [body.data, ...prev]);
      setActiveBankPayment(null);
    } catch {
      setError(t("paymentCreateFailed"));
    } finally {
      setBankBusy(false);
    }
  };

  const latestBankSubmission = bankSubmissions[0];

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-body-md font-semibold! text-text-primary">
            {roleT(role)}
          </span>
          {roles[0].subscription ? (
            <Badge variant={roles[0].active ? "success" : "neutral"}>
              {roles[0].active ? t("status.active") : t("status.expired")}
            </Badge>
          ) : null}
        </div>
        {roles[0].subscription?.currentPeriodEnd ? (
          <p className="text-body-sm text-text-secondary">
            {t("renewsOn", {
              date: new Date(
                roles[0].subscription.currentPeriodEnd,
              ).toLocaleDateString("vi-VN"),
            })}
          </p>
        ) : null}

        <NativeSelect
          label={t("billingIntervalLabel")}
          value={interval}
          onChange={(v) => setInterval(v as "month" | "year")}
          options={[
            {
              value: "month",
              label: `${t("perMonth")} — ${formatCurrency(monthlyPrices[role] ?? 0)}`,
            },
            {
              value: "year",
              label: `${t("perYear")} — ${formatCurrency(yearlyPrices[role] ?? 0)}`,
            },
          ]}
        />
        <p className="text-body-md font-semibold! text-text-primary">
          {formatCurrency(amount ?? 0)}
        </p>
      </Card>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="flex flex-col gap-3">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("paymentMethodLabel")}
        </span>

        {momoEnabled ? (
          <Button
            variant="secondary"
            className="justify-between"
            disabled={busyMethod !== null}
            onClick={() => payWith("momo")}
          >
            {t("payWithMomo")}
            {busyMethod === "momo" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
          </Button>
        ) : null}

        {zalopayEnabled ? (
          <Button
            variant="secondary"
            className="justify-between"
            disabled={busyMethod !== null}
            onClick={() => payWith("zalopay")}
          >
            {t("payWithZalopay")}
            {busyMethod === "zalopay" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
          </Button>
        ) : null}

        {bankTransferEnabled ? (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-text-tertiary" />
              <span className="text-body-md font-semibold! text-text-primary">
                {t("payWithBankTransfer")}
              </span>
            </div>

            {activeBankPayment ? (
              bankInfo ? (
                <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] bg-bg-sunken p-3.5 text-body-sm">
                  <p>
                    <span className="text-text-tertiary">
                      {t("bankNameLabel")}:{" "}
                    </span>
                    <span className="font-semibold! text-text-primary">
                      {bankInfo.bankName}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-tertiary">
                      {t("accountNumberLabel")}:{" "}
                    </span>
                    <span className="font-semibold! text-text-primary">
                      {bankInfo.accountNumber}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-tertiary">
                      {t("accountNameLabel")}:{" "}
                    </span>
                    <span className="font-semibold! text-text-primary">
                      {bankInfo.accountName}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-tertiary">
                      {t("amountLabel")}:{" "}
                    </span>
                    <span className="font-semibold! text-text-primary">
                      {formatCurrency(activeBankPayment.amount)}
                    </span>
                  </p>
                  <p>
                    <span className="text-text-tertiary">
                      {t("transferReferenceLabel")}:{" "}
                    </span>
                    <span className="font-semibold! text-brand-primary">
                      {activeBankPayment.providerOrderId}
                    </span>
                  </p>
                  <p className="text-text-tertiary">
                    {t("transferReferenceHint")}
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void submitProof(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={bankBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {bankBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {t("uploadProof")}
                  </Button>
                </div>
              ) : null
            ) : latestBankSubmission?.status === "AWAITING_REVIEW" ? (
              <p className="text-body-sm text-text-secondary">
                {t("awaitingReview")}
              </p>
            ) : (
              <Button
                variant="secondary"
                disabled={bankBusy}
                onClick={startBankTransfer}
              >
                {bankBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("startBankTransfer")}
              </Button>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
