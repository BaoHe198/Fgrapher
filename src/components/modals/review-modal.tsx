"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarInput } from "@/components/ui/star-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  providerName: string;
  serviceName?: string;
  existingReview?: {
    id: string;
    rating: number;
    content: string | null;
  } | null;
  initialRating?: number;
  onSuccess?: () => void;
}

const MAX_LENGTH = 1000;
const MIN_LENGTH = 20;

export function ReviewModal({
  open,
  onOpenChange,
  bookingId,
  providerName,
  serviceName,
  existingReview,
  initialRating = 0,
  onSuccess,
}: ReviewModalProps) {
  const t = useTranslations("sharedComponents.reviewModal");
  const [rating, setRating] = useState(existingReview?.rating ?? initialRating);
  const [content, setContent] = useState(existingReview?.content ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The Dialog toggles visibility rather than mount/unmount, so `open`
  // flipping true doesn't re-run the useState initializers above — without
  // this, reopening with a different initialRating (e.g. clicking a
  // different star on the inline prompt) would keep showing the previous
  // rating.
  useEffect(() => {
    if (open) {
      startTransition(() => {
        setRating(existingReview?.rating ?? initialRating);
        setContent(existingReview?.content ?? "");
        setError(null);
      });
    }
    // existingReview/initialRating deliberately omitted — this only needs
    // to reset when the dialog transitions closed->open (per the comment
    // above), and the callback is redefined every render anyway, so it
    // reads whatever those props currently are at the moment `open`
    // actually flips, not a stale value from an earlier render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEdit = Boolean(existingReview);

  const onSubmit = async () => {
    setError(null);
    if (rating === 0) {
      setError(t("chooseRating"));
      return;
    }
    if (content.trim().length < MIN_LENGTH) {
      setError(t("needMoreDetail", { min: MIN_LENGTH }));
      return;
    }

    setIsSubmitting(true);
    const res = isEdit
      ? await fetch(`/api/reviews/${existingReview!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, content }),
        })
      : await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, rating, content }),
        });
    const body = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(body.message ?? t("genericError"));
      return;
    }

    toast.add({
      title: isEdit ? t("updated") : t("posted"),
      type: "success",
    });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("newTitle", { name: providerName })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {serviceName ? (
            <p className="text-body-sm text-text-secondary">{serviceName}</p>
          ) : null}

          <StarInput value={rating} onChange={setRating} size={40} showLabel />

          <div className="flex flex-col gap-1.5">
            <label className="text-body-sm font-semibold text-text-primary">
              {t("shareExperience")}
            </label>
            <Textarea
              rows={5}
              maxLength={MAX_LENGTH}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("contentPlaceholder")}
            />
            <span className="self-end text-body-sm text-text-tertiary">
              {content.length}/{MAX_LENGTH}
            </span>
          </div>

          {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="accent" disabled={isSubmitting} onClick={onSubmit}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? t("saveChanges") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
