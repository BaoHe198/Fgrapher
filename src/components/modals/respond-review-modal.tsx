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
import { StarRating } from "@/components/ui/star-rating";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

interface RespondReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewId: string;
  reviewerName: string;
  rating: number;
  content: string | null;
  existingResponse?: string | null;
  onSuccess?: () => void;
}

const MAX_LENGTH = 500;

export function RespondReviewModal({
  open,
  onOpenChange,
  reviewId,
  reviewerName,
  rating,
  content,
  existingResponse,
  onSuccess,
}: RespondReviewModalProps) {
  const t = useTranslations("sharedComponents.respondReviewModal");
  const [response, setResponse] = useState(existingResponse ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(existingResponse);

  const onSubmit = async () => {
    setError(null);
    if (!response.trim()) {
      setError(t("emptyError"));
      return;
    }

    setIsSubmitting(true);
    const res = await fetch(`/api/reviews/${reviewId}/respond`, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    const body = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(body.message ?? t("genericError"));
      return;
    }

    toast.add({ title: isEdit ? t("updated") : t("posted"), type: "success" });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-[var(--fg-radius-md)] bg-bg-sunken p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-semibold text-text-primary">
                {reviewerName}
              </span>
              <StarRating
                rating={rating}
                reviews={0}
                className="[&>span:last-child]:hidden"
              />
            </div>
            {content ? (
              <p className="text-body-sm text-text-secondary">{content}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-body-sm font-semibold text-text-primary">
              {t("yourResponse")}
            </label>
            <Textarea
              rows={4}
              maxLength={MAX_LENGTH}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder={t("placeholder")}
            />
            <span className="self-end text-body-sm text-text-tertiary">
              {response.length}/{MAX_LENGTH}
            </span>
          </div>

          <p className="text-body-sm text-text-tertiary">{t("note")}</p>

          {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="accent" disabled={isSubmitting} onClick={onSubmit}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("postResponse")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
