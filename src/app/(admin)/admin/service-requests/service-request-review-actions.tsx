"use client";

import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

export function ServiceRequestReviewActions({
  requestId,
}: {
  requestId: string;
}) {
  const t = useTranslations("accountFlows.admin.serviceRequests");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const review = async (action: "approve" | "reject") => {
    if (busyAction || (action === "reject" && reason.trim().length < 3)) {
      return;
    }
    setError(null);
    setBusyAction(action);
    try {
      const response = await fetch(`/api/admin/service-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "approve" ? { action } : { action, reason: reason.trim() },
        ),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.message ?? t("reviewFailed"));
        return;
      }

      toast.add({
        title: action === "approve" ? t("approvedToast") : t("rejectedToast"),
        type: "success",
      });
      router.refresh();
    } catch {
      setError(t("reviewFailed"));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
      <Textarea
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t("rejectionReasonPlaceholder")}
      />
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="accent"
          disabled={busyAction !== null}
          onClick={() => review("approve")}
        >
          {busyAction === "approve" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {t("approve")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-danger"
          disabled={busyAction !== null || reason.trim().length < 3}
          onClick={() => review("reject")}
        >
          {busyAction === "reject" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}
