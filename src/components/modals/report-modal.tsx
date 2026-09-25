"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { REPORT_REASONS } from "@/lib/constants";

const REASONS: string[] = [...REPORT_REASONS];

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "review" | "user" | "message" | "product" | "post";
  targetId: string;
}

const TARGET_KEY = {
  review: "targetReview",
  user: "targetUser",
  message: "targetMessage",
  product: "targetProduct",
  post: "targetPost",
} as const;

export function ReportModal({
  open,
  onOpenChange,
  targetType,
  targetId,
}: ReportModalProps) {
  const t = useTranslations("sharedComponents.reportModal");
  // No reason picked in advance: with "Spam" preselected, one careless tap
  // filed a spam report the visitor never chose.
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!reason) return;
    setIsSubmitting(true);
    setError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetId,
        reason,
        description: description || undefined,
      }),
    }).catch(() => null);
    setIsSubmitting(false);

    if (res?.ok) {
      toast.add({ title: t("submitted"), type: "success" });
      onOpenChange(false);
      setDescription("");
      setReason("");
    } else {
      const body = await res?.json().catch(() => null);
      setError(body?.message ?? t("submitFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("title", { target: t(TARGET_KEY[targetType]) })}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <NativeSelect
            label={t("reasonLabel")}
            value={reason}
            onChange={setReason}
            options={[
              { value: "", label: t("reasonPlaceholder") },
              ...REASONS.map((r) => ({
                value: r,
                label: t(`reasons.${r}`),
              })),
            ]}
          />
          <Textarea
            placeholder={t("detailsPlaceholder")}
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          {error ? (
            <p className="text-body-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={isSubmitting || !reason}
            onClick={onSubmit}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
