"use client";

import type { ProfileCategory, RequestOfferStatus, Role } from "@prisma/client";
import { ArrowLeft, BadgeCheck, Loader2, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { avatarFallbackColor, cn, formatCurrency } from "@/lib/utils";
import { formatDate } from "@/lib/format";

interface OfferView {
  id: string;
  status: RequestOfferStatus;
  message: string | null;
  proposedPrice: number;
  proposedDate: string | null;
  createdAt: string;
  provider: {
    id: string;
    name: string;
    avatar: string | null;
    username: string | null;
    verified: boolean;
  };
}

interface RequestView {
  id: string;
  code: string;
  title: string;
  description: string | null;
  role: Role;
  categories: ProfileCategory[];
  status: string;
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
  offers: OfferView[];
}

const OFFER_STATUS_VARIANT: Record<
  RequestOfferStatus,
  "warning" | "success" | "neutral" | "destructive"
> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "destructive",
  WITHDRAWN: "neutral",
};

export function RequestDetail({
  backLabel,
  request,
}: {
  backLabel: string;
  request: RequestView;
}) {
  const t = useTranslations("dashboardCore.serviceRequests.detail");
  const statusT = useTranslations("dashboardCore.serviceRequests.status");
  const roleT = useTranslations("role");
  const categoryT = useTranslations("profileCategory");
  const router = useRouter();

  const [offers, setOffers] = useState(request.offers);
  const [status, setStatus] = useState(request.status);
  const [acceptingOffer, setAcceptingOffer] = useState<OfferView | null>(null);
  const [acceptDate, setAcceptDate] = useState(
    request.shootDate?.slice(0, 10) ?? "",
  );
  const [acceptTime, setAcceptTime] = useState("");
  const [acceptLocationType, setAcceptLocationType] = useState<
    "PROVIDER" | "CUSTOMER" | "OUTDOOR"
  >("OUTDOOR");
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const decline = async (offerId: string) => {
    setBusyOfferId(offerId);
    const res = await fetch(`/api/offers/${offerId}/decline`, {
      method: "POST",
    });
    setBusyOfferId(null);
    if (res.ok) {
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, status: "DECLINED" } : o)),
      );
      toast.add({ title: t("offerDeclinedToast"), type: "success" });
    }
  };

  const openAccept = (offer: OfferView) => {
    setAcceptingOffer(offer);
    setAcceptDate(
      offer.proposedDate?.slice(0, 10) ?? request.shootDate?.slice(0, 10) ?? "",
    );
    setAcceptError(null);
  };

  const confirmAccept = async () => {
    if (!acceptingOffer) return;
    setAcceptError(null);
    setIsAccepting(true);
    const res = await fetch(`/api/offers/${acceptingOffer.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: acceptDate,
        startTime: acceptTime,
        locationType: acceptLocationType,
      }),
    });
    const body = await res.json();
    setIsAccepting(false);

    if (!res.ok) {
      setAcceptError(body.message ?? t("genericError"));
      return;
    }

    toast.add({ title: t("offerAcceptedToast"), type: "success" });
    router.push(`/dashboard/bookings/${body.data.id}`);
  };

  const cancelRequest = async () => {
    if (!window.confirm(t("cancelConfirm"))) return;
    setIsCancelling(true);
    const res = await fetch(`/api/requests/${request.id}`, {
      method: "DELETE",
    });
    setIsCancelling(false);
    if (res.ok) {
      setStatus("CANCELLED");
      toast.add({ title: t("cancelledToast"), type: "success" });
    }
  };

  const canManage = status === "OPEN" || status === "HAS_OFFERS";

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/requests"
        className="flex w-fit items-center gap-1.5 text-body-sm font-semibold! text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-heading-md text-text-primary">{request.title}</p>
            <p className="text-body-sm text-text-tertiary">{request.code}</p>
          </div>
          <Badge
            variant={
              status === "FULFILLED"
                ? "success"
                : status === "CANCELLED" || status === "EXPIRED"
                  ? "destructive"
                  : "warning"
            }
          >
            {statusT(status)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="accent">{roleT(request.role)}</Badge>
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

        {canManage ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-danger"
            disabled={isCancelling}
            onClick={cancelRequest}
          >
            {isCancelling ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("cancelRequest")}
          </Button>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3">
        <p className="text-body-sm font-semibold! text-text-secondary">
          {t("offersCount", { count: offers.length })}
        </p>

        {offers.length === 0 ? (
          <Card className="py-10 text-center text-body-sm text-text-secondary">
            {t("noOffers")}
          </Card>
        ) : (
          offers.map((offer) => (
            <Card key={offer.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Avatar>
                    {offer.provider.avatar ? (
                      <AvatarImage
                        src={offer.provider.avatar}
                        alt={offer.provider.name}
                      />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        "text-white",
                        avatarFallbackColor(offer.provider.name),
                      )}
                    >
                      {offer.provider.name[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-body-md font-semibold! text-text-primary">
                        {offer.provider.name}
                      </span>
                      {offer.provider.verified ? (
                        <BadgeCheck className="size-4 text-brand-primary" />
                      ) : null}
                    </div>
                    <span className="text-body-sm text-text-tertiary">
                      {formatDate(offer.createdAt)}
                    </span>
                  </div>
                </div>
                <Badge variant={OFFER_STATUS_VARIANT[offer.status]}>
                  {t(`offerStatus.${offer.status}`)}
                </Badge>
              </div>

              <p className="text-body-lg font-semibold! text-text-primary">
                {formatCurrency(offer.proposedPrice)}
              </p>
              {offer.message ? (
                <p className="text-body-sm text-text-secondary">
                  {offer.message}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {offer.provider.username ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link href={`/profile/${offer.provider.username}`} />
                    }
                  >
                    {t("viewProfile")}
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link
                      href={`/dashboard/messages?to=${offer.provider.id}`}
                    />
                  }
                >
                  <MessageCircle className="size-4" />
                  {t("message")}
                </Button>
                {offer.status === "PENDING" && canManage ? (
                  <>
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => openAccept(offer)}
                    >
                      {t("accept")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      disabled={busyOfferId === offer.id}
                      onClick={() => decline(offer.id)}
                    >
                      {busyOfferId === offer.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {t("decline")}
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={acceptingOffer !== null}
        onOpenChange={(open) => !open && setAcceptingOffer(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("acceptDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              label={t("acceptDateLabel")}
              type="date"
              value={acceptDate}
              onChange={(e) => setAcceptDate(e.target.value)}
            />
            <Input
              label={t("acceptTimeLabel")}
              type="time"
              value={acceptTime}
              onChange={(e) => setAcceptTime(e.target.value)}
            />
            <NativeSelect
              label={t("acceptLocationLabel")}
              value={acceptLocationType}
              onChange={(value) =>
                setAcceptLocationType(
                  value as "PROVIDER" | "CUSTOMER" | "OUTDOOR",
                )
              }
              options={[
                { value: "OUTDOOR", label: t("locationOutdoor") },
                { value: "PROVIDER", label: t("locationProvider") },
                { value: "CUSTOMER", label: t("locationCustomer") },
              ]}
            />
            {acceptError ? (
              <p className="text-body-sm text-danger">{acceptError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAcceptingOffer(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="accent"
              disabled={isAccepting || !acceptDate || !acceptTime}
              onClick={confirmAccept}
            >
              {isAccepting ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("confirmAccept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
