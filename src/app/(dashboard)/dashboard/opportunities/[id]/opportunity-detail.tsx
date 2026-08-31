"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";

interface OfferView {
  id: string;
  status: string;
  message: string | null;
  proposedPrice: number;
  proposedDate: string | null;
}

interface RequestView {
  id: string;
  code: string;
  title: string;
  description: string | null;
  categories: ProfileCategory[];
  shootDate: string | null;
  isDateFlexible: boolean;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  province: string;
  ward: string | null;
  areaNote: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  references: { mediaUrl: string }[];
  customerName: string;
}

export function OpportunityDetail({
  backLabel,
  role,
  request,
  myOffer,
}: {
  backLabel: string;
  role: Role;
  request: RequestView;
  myOffer: OfferView | null;
}) {
  const t = useTranslations("dashboardCore.opportunities.detail");
  const categoryT = useTranslations("profileCategory");

  const [offer, setOffer] = useState(myOffer);
  const [message, setMessage] = useState(myOffer?.message ?? "");
  const [proposedPrice, setProposedPrice] = useState(
    myOffer?.proposedPrice?.toString() ?? "",
  );
  const [proposedDate, setProposedDate] = useState(
    myOffer?.proposedDate?.slice(0, 10) ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditable = !offer || offer.status === "PENDING";

  const submitOffer = async () => {
    setError(null);
    setIsSubmitting(true);
    const payload = {
      role,
      message: message || undefined,
      proposedPrice: Number(proposedPrice),
      proposedDate: request.isDateFlexible
        ? proposedDate || undefined
        : undefined,
    };
    const res = offer
      ? await fetch(`/api/offers/${offer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/opportunities/${request.id}/offers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    const body = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(body.message ?? t("genericError"));
      return;
    }

    setOffer(body.data);
    toast.add({ title: t("offerSentToast"), type: "success" });
  };

  const withdraw = async () => {
    if (!offer) return;
    if (!window.confirm(t("withdrawConfirm"))) return;
    setIsWithdrawing(true);
    const res = await fetch(`/api/offers/${offer.id}`, { method: "DELETE" });
    setIsWithdrawing(false);
    if (res.ok) {
      setOffer((prev) => (prev ? { ...prev, status: "WITHDRAWN" } : prev));
      toast.add({ title: t("withdrawnToast"), type: "success" });
    }
  };

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-5">
      <Link
        href="/dashboard/opportunities"
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold! text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <Card className="flex flex-col gap-3">
        <div>
          <p className="text-heading-md text-text-primary">{request.title}</p>
          <p className="text-body-sm text-text-tertiary">
            {request.code} · {t("postedBy", { name: request.customerName })}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {request.categories.map((c) => (
            <Badge key={c} variant="neutral">
              {categoryT(c)}
            </Badge>
          ))}
        </div>

        {request.description ? (
          <p className="text-body-sm text-text-secondary">
            {request.description}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-3">
          <div>
            <span className="text-text-tertiary">{t("whenLabel")}</span>
            <p className="font-semibold text-text-primary">
              {request.isDateFlexible
                ? t("flexibleRange", {
                    start: request.dateRangeStart
                      ? formatDate(request.dateRangeStart)
                      : "?",
                    end: request.dateRangeEnd
                      ? formatDate(request.dateRangeEnd)
                      : "?",
                  })
                : request.shootDate
                  ? formatDate(request.shootDate)
                  : "—"}
            </p>
          </div>
          <div>
            <span className="text-text-tertiary">{t("whereLabel")}</span>
            <p className="font-semibold text-text-primary">
              {request.ward ? `${request.ward}, ` : ""}
              {request.province}
              {request.areaNote ? ` — ${request.areaNote}` : ""}
            </p>
          </div>
          <div>
            <span className="text-text-tertiary">{t("budgetLabel")}</span>
            <p className="font-semibold text-text-primary">
              {request.budgetMin || request.budgetMax
                ? `${formatCurrency(request.budgetMin ?? 0)} – ${formatCurrency(request.budgetMax ?? 0)}`
                : t("budgetNotSet")}
            </p>
          </div>
        </div>

        {request.references.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {request.references.map((ref) => (
              // eslint-disable-next-line @next/next/no-img-element -- brief reference thumbnail
              <img
                key={ref.mediaUrl}
                src={ref.mediaUrl}
                alt=""
                className="size-16 rounded-[var(--fg-radius-sm)] object-cover"
              />
            ))}
          </div>
        ) : null}

        <p className="text-body-sm text-text-tertiary">
          {t("addressHiddenNote")}
        </p>
      </Card>

      <Card className="flex flex-col gap-3.5">
        <p className="text-body-md font-semibold! text-text-primary">
          {offer ? t("yourOfferTitle") : t("sendOfferTitle")}
        </p>

        {offer && offer.status !== "PENDING" ? (
          <Badge
            variant={offer.status === "ACCEPTED" ? "success" : "destructive"}
            className="w-fit"
          >
            {t(`offerStatus.${offer.status}`)}
          </Badge>
        ) : null}

        <CurrencyInput
          label={t("proposedPriceLabel")}
          value={proposedPrice}
          disabled={!isEditable}
          onChange={setProposedPrice}
        />
        {request.isDateFlexible ? (
          <Input
            label={t("proposedDateLabel")}
            type="date"
            value={proposedDate}
            disabled={!isEditable}
            onChange={(e) => setProposedDate(e.target.value)}
          />
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label className="text-body-sm font-semibold! text-text-primary">
            {t("messageLabel")}
          </label>
          <Textarea
            rows={3}
            value={message}
            disabled={!isEditable}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {error ? <p className="text-body-sm text-danger">{error}</p> : null}

        {isEditable ? (
          <div className="flex items-center gap-2">
            <Button
              variant="accent"
              disabled={isSubmitting || !proposedPrice}
              onClick={submitOffer}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {offer ? t("updateOffer") : t("sendOffer")}
            </Button>
            {offer ? (
              <Button
                variant="ghost"
                className="text-danger"
                disabled={isWithdrawing}
                onClick={withdraw}
              >
                {isWithdrawing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {t("withdraw")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
