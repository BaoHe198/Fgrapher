"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

interface DataSettingsContentProps {
  initialConsent: { MARKETING: boolean; ANALYTICS: boolean };
  pendingDeletion: boolean;
  summary: {
    profiles: number;
    bookingsAsCustomer: number;
    bookingsAsProvider: number;
    reviewsWritten: number;
    reviewsReceived: number;
    orders: number;
  };
}

const SUMMARY_KEYS: {
  key: keyof DataSettingsContentProps["summary"];
  labelKey:
    | "profiles"
    | "bookingsAsCustomer"
    | "bookingsAsProvider"
    | "reviewsWritten"
    | "reviewsReceived"
    | "orders";
}[] = [
  { key: "profiles", labelKey: "profiles" },
  { key: "bookingsAsCustomer", labelKey: "bookingsAsCustomer" },
  { key: "bookingsAsProvider", labelKey: "bookingsAsProvider" },
  { key: "reviewsWritten", labelKey: "reviewsWritten" },
  { key: "reviewsReceived", labelKey: "reviewsReceived" },
  { key: "orders", labelKey: "orders" },
];

export function DataSettingsContent({
  initialConsent,
  pendingDeletion,
  summary,
}: DataSettingsContentProps) {
  const t = useTranslations("dashboardSettings.data");
  const [consent, setConsent] = useState(initialConsent);
  const [isExporting, setIsExporting] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(pendingDeletion);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [deleteStep, setDeleteStep] = useState<
    "closed" | "explain" | "confirm"
  >("closed");

  const toggleConsent = async (
    purpose: "MARKETING" | "ANALYTICS",
    granted: boolean,
  ) => {
    setConsent((prev) => ({ ...prev, [purpose]: granted }));
    const res = await fetch("/api/users/me/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, granted }),
    });
    if (!res.ok) {
      setConsent((prev) => ({ ...prev, [purpose]: !granted }));
      toast.add({ title: t("toastConsentUpdateFail"), type: "error" });
      return;
    }
    toast.add({ title: t("toastConsentUpdateSuccess"), type: "success" });
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/users/me/export", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.add({
          title: body.message ?? t("toastExportFail"),
          type: "error",
        });
        return;
      }
      const blob = new Blob([JSON.stringify(body.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "fgrapher-du-lieu-cua-toi.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.add({ title: t("toastExportSuccess"), type: "success" });
    } finally {
      setIsExporting(false);
    }
  };

  const requestDeletion = async () => {
    setIsRequestingDeletion(true);
    try {
      const res = await fetch("/api/users/me/deletion-request", {
        method: "POST",
      });
      if (!res.ok) {
        toast.add({
          title: t("toastDeletionRequestFail"),
          type: "error",
        });
        return;
      }
      setDeletionRequested(true);
      setDeleteStep("closed");
      toast.add({
        title: t("toastDeletionRequestSuccessTitle"),
        description: t("toastDeletionRequestSuccessDesc"),
        type: "success",
      });
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-body-md font-semibold! text-text-primary">
          {t("overviewTitle")}
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SUMMARY_KEYS.map(({ key, labelKey }) => (
            <div
              key={key}
              className="rounded-[var(--fg-radius-md)] border border-border-subtle p-3"
            >
              <div className="text-heading-md text-text-primary">
                {summary[key]}
              </div>
              <div className="text-body-sm text-text-secondary">
                {t(`summary.${labelKey}`)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-3">
        <span className="text-body-md font-semibold! text-text-primary">
          {t("consentTitle")}
        </span>
        <p className="text-body-sm text-text-secondary">{t("consentIntro")}</p>
        <div className="flex items-center justify-between rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-body-md text-text-primary">
              {t("marketingLabel")}
            </span>
            <span className="text-body-sm text-text-secondary">
              {t("marketingDesc")}
            </span>
          </div>
          <Switch
            aria-label={t("marketingLabel")}
            checked={consent.MARKETING}
            onChange={(value) => toggleConsent("MARKETING", value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-body-md text-text-primary">
              {t("analyticsLabel")}
            </span>
            <span className="text-body-sm text-text-secondary">
              {t("analyticsDesc")}
            </span>
          </div>
          <Switch
            aria-label={t("analyticsLabel")}
            checked={consent.ANALYTICS}
            onChange={(value) => toggleConsent("ANALYTICS", value)}
          />
        </div>
        <p className="text-body-sm text-text-tertiary">
          {t("privacyPolicyIntro")}{" "}
          <Link href="/privacy" className="text-text-link hover:underline">
            {t("privacyPolicyLink")}
          </Link>
          .
        </p>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-3">
        <span className="text-body-md font-semibold! text-text-primary">
          {t("myDataTitle")}
        </span>
        <p className="text-body-sm text-text-secondary">{t("myDataDesc")}</p>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={isExporting}
          onClick={exportData}
        >
          {isExporting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("downloadButton")}
        </Button>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] border border-danger p-4">
        <span className="text-body-md font-semibold! text-danger">
          {t("deleteAccountTitle")}
        </span>
        <p className="text-body-sm text-text-secondary">
          {t("deleteAccountDesc")}
        </p>
        {deletionRequested ? (
          <p className="text-body-sm font-semibold! text-warning">
            {t("pendingDeletionNotice")}
          </p>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="self-start"
            onClick={() => setDeleteStep("explain")}
          >
            {t("requestDeletionButton")}
          </Button>
        )}

        <Dialog
          open={deleteStep !== "closed"}
          onOpenChange={(open) => setDeleteStep(open ? "explain" : "closed")}
        >
          <DialogContent>
            {deleteStep === "explain" ? (
              <>
                <DialogHeader>
                  <DialogTitle>{t("explainDialogTitle")}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 text-body-sm text-text-secondary">
                  <div>
                    <span className="font-semibold text-text-primary">
                      {t("explainWillBeDeletedLabel")}{" "}
                    </span>
                    {t("explainWillBeDeletedBody")}
                  </div>
                  <div>
                    <span className="font-semibold text-text-primary">
                      {t("explainWillBeKeptLabel")}{" "}
                    </span>
                    {t("explainWillBeKeptBody")}
                  </div>
                  <div className="font-semibold text-danger">
                    {t("explainIrreversible")}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteStep("closed")}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteStep("confirm")}
                  >
                    {t("continueBtn")}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{t("confirmDialogTitle")}</DialogTitle>
                </DialogHeader>
                <p className="text-body-sm text-text-secondary">
                  {t("confirmDialogBody")}
                </p>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteStep("explain")}
                  >
                    {t("back")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isRequestingDeletion}
                    onClick={requestDeletion}
                  >
                    {isRequestingDeletion ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {t("confirmSubmit")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
