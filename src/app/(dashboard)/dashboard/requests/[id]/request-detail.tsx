"use client";

import type { ProfileCategory, RequestOfferStatus, Role } from "@prisma/client";
import {
  ArrowLeft,
  BadgeCheck,
  Loader2,
  MessageCircle,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReferenceMediaGallery } from "@/components/media/reference-media-gallery";
import { CallSheet } from "@/components/requests/call-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { buildMediaVariants } from "@/lib/media/variants";
import {
  avatarFallbackColor,
  cn,
  formatBudgetRange,
  formatCurrency,
} from "@/lib/utils";

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
    avgRating: number | null;
    reviewCount: number;
    samples: { url: string; width: number | null; height: number | null }[];
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
  moderationReason: string | null;
  daysLeft: number;
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

const MAX_COMPARE = 3;
const RATING = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// A request and its proposals (wave 2, Đặt lịch F). The call sheet sums up
// what was asked, stamped with where it stands; each proposal leads with
// the price, then the artist's real rating, three of their photos and the
// message. Two or three proposals can be put side by side. Choosing one
// asks for the booking details first (that is the confirmation), and from
// then on the others can only be messaged.
export function RequestDetail({
  backLabel,
  request,
}: {
  backLabel: string;
  request: RequestView;
}) {
  const t = useTranslations("dashboardCore.serviceRequests.detail");
  const statusT = useTranslations("dashboardCore.serviceRequests.status");
  const tService = useTranslations("publicPages.requestsF.service");
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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

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
      setCompareIds((ids) => ids.filter((id) => id !== offerId));
      toast.add({ title: t("offerDeclinedToast"), type: "success" });
    }
  };

  const openAccept = (offer: OfferView) => {
    setCompareOpen(false);
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

  const toggleCompare = (offerId: string) =>
    setCompareIds((ids) =>
      ids.includes(offerId)
        ? ids.filter((id) => id !== offerId)
        : ids.length >= MAX_COMPARE
          ? ids
          : [...ids, offerId],
    );

  const canManage =
    status === "PENDING_REVIEW" || status === "OPEN" || status === "HAS_OFFERS";
  const showOffers = status !== "PENDING_REVIEW" && status !== "REJECTED";
  const expired = status === "EXPIRED";
  const choosable = offers.filter((o) => o.status === "PENDING");
  const comparing = offers.filter((o) => compareIds.includes(o.id));

  const stamp = (() => {
    switch (status) {
      case "OPEN":
      case "HAS_OFFERS":
        return {
          text: t("stamp.daysLeft", { days: request.daysLeft }),
          tone: "accent" as const,
        };
      case "EXPIRED":
        return { text: t("stamp.expired"), tone: "danger" as const };
      case "REJECTED":
        return { text: statusT(status), tone: "danger" as const };
      default:
        return { text: statusT(status), tone: "neutral" as const };
    }
  })();

  const when = request.isDateFlexible
    ? [
        request.shootDate ? formatDate(request.shootDate) : null,
        request.dateRangeStart || request.dateRangeEnd
          ? t("flexibleRange", {
              start: request.dateRangeStart
                ? formatDate(request.dateRangeStart)
                : "—",
              end: request.dateRangeEnd
                ? formatDate(request.dateRangeEnd)
                : "—",
            })
          : t("flexibleNoRange"),
      ]
        .filter(Boolean)
        .join("\n")
    : request.shootDate
      ? formatDate(request.shootDate)
      : undefined;

  const priceLine = (offer: OfferView) => (
    <span className="font-display text-[1.75rem] leading-none font-semibold tracking-[-0.02em] text-text-primary">
      {formatCurrency(offer.proposedPrice)}
    </span>
  );
  const ratingLine = (offer: OfferView) =>
    offer.provider.reviewCount > 0 && offer.provider.avgRating !== null ? (
      <span className="inline-flex items-center gap-1 text-body-sm text-text-secondary">
        <Star aria-hidden className="size-3.5 fill-gold-400 text-gold-400" />
        {t("rating", {
          rating: RATING.format(offer.provider.avgRating),
          count: offer.provider.reviewCount,
        })}
      </span>
    ) : (
      <span className="text-body-sm text-text-tertiary">{t("noRating")}</span>
    );
  const samples = (offer: OfferView, size: "card" | "table") =>
    offer.provider.samples.length > 0 ? (
      <ol className="grid grid-cols-3 gap-1.5">
        {offer.provider.samples.map((sample, i) => (
          <li key={sample.url} className="flex flex-col gap-1">
            <span className="relative block aspect-square bg-bg-sunken">
              <Image
                src={buildMediaVariants(sample.url).thumbnail}
                alt={t("sampleAlt", { name: offer.provider.name, n: i + 1 })}
                fill
                unoptimized
                sizes={size === "card" ? "120px" : "90px"}
                className="object-contain"
              />
            </span>
          </li>
        ))}
      </ol>
    ) : (
      <span className="text-body-sm text-text-tertiary">{t("noSamples")}</span>
    );

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Link
        href="/dashboard/requests"
        className="focus-ring flex w-fit items-center gap-1.5 rounded-[var(--fg-radius-sm)] text-body-sm font-semibold! text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-semibold text-text-tertiary">
          {request.code} · {statusT(status)}
        </span>
        <h1 className="text-display-md text-balance text-text-primary">
          {request.title}
        </h1>
      </div>

      {status === "PENDING_REVIEW" ? (
        <div className="rounded-[var(--fg-radius-md)] border border-warning/30 bg-warning-bg p-3 text-body-sm text-text-secondary">
          <p className="font-semibold! text-text-primary">
            {t("pendingReviewTitle")}
          </p>
          <p>{t("pendingReviewBody")}</p>
        </div>
      ) : null}

      {status === "REJECTED" ? (
        <div className="rounded-[var(--fg-radius-md)] border border-danger/30 bg-danger-bg p-3 text-body-sm text-text-secondary">
          <p className="font-semibold! text-danger">{t("rejectedTitle")}</p>
          <p>{t("rejectedBody")}</p>
          {request.moderationReason ? (
            <p className="mt-1 font-semibold! text-text-primary">
              {t("rejectionReason", { reason: request.moderationReason })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section
          aria-labelledby="rq-offers"
          className="order-2 flex min-w-0 flex-col gap-4 lg:order-1"
        >
          {showOffers ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="rq-offers"
                  className="text-heading-md text-text-primary"
                >
                  {t("offersCount", { count: offers.length })}
                </h2>
                {choosable.length >= 2 && canManage ? (
                  <span className="text-body-sm text-text-tertiary">
                    {t("compareHint", { max: MAX_COMPARE })}
                  </span>
                ) : null}
              </div>

              {offers.length === 0 ? (
                <EmptyState
                  title={expired ? t("expiredNoOffers") : t("noOffers")}
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {offers.map((offer) => {
                    const chosen = offer.status === "ACCEPTED";
                    const inCompare = compareIds.includes(offer.id);
                    return (
                      <li
                        key={offer.id}
                        className={cn(
                          "flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border bg-bg-surface p-5",
                          chosen
                            ? "border-brand-primary shadow-[inset_0_0_0_1px_var(--brand-primary)]"
                            : "border-border-subtle",
                          inCompare && "border-gold-400",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-col gap-1.5">
                            {priceLine(offer)}
                            <span className="text-body-sm text-text-secondary">
                              {offer.proposedDate
                                ? t("proposedDate", {
                                    date: formatDate(offer.proposedDate),
                                  })
                                : t("proposedDateNone")}
                            </span>
                          </div>
                          {offer.status !== "PENDING" ? (
                            <Badge variant={OFFER_STATUS_VARIANT[offer.status]}>
                              {chosen
                                ? t("chosen")
                                : t(`offerStatus.${offer.status}`)}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3">
                          <Avatar>
                            {offer.provider.avatar ? (
                              <AvatarImage src={offer.provider.avatar} alt="" />
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
                          <div className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 text-body-md font-semibold! text-text-primary">
                              <span className="truncate">
                                {offer.provider.name}
                              </span>
                              {offer.provider.verified ? (
                                <BadgeCheck
                                  aria-label={t("verified")}
                                  className="size-4 shrink-0 text-brand-primary"
                                />
                              ) : null}
                            </span>
                            <span className="flex flex-wrap gap-x-3">
                              {ratingLine(offer)}
                              <span className="text-body-sm text-text-tertiary">
                                {t("sentOn", {
                                  date: formatDate(offer.createdAt),
                                })}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="max-w-sm">{samples(offer, "card")}</div>

                        {offer.message ? (
                          <OfferMessage text={offer.message} />
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
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
                            <MessageCircle aria-hidden className="size-4" />
                            {t("message")}
                          </Button>
                          {offer.provider.username ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              nativeButton={false}
                              render={
                                <Link
                                  href={`/profile/${offer.provider.username}`}
                                />
                              }
                            >
                              {t("viewProfile")}
                            </Button>
                          ) : null}
                          {offer.status === "PENDING" &&
                          canManage &&
                          choosable.length >= 2 ? (
                            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-body-sm text-text-secondary">
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--brand-primary)]"
                                checked={inCompare}
                                disabled={
                                  !inCompare && compareIds.length >= MAX_COMPARE
                                }
                                onChange={() => toggleCompare(offer.id)}
                              />
                              {t("compare")}
                            </label>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}
        </section>

        <aside className="order-1 flex flex-col gap-4 lg:sticky lg:top-[104px] lg:order-2">
          <CallSheet
            code={request.code}
            stamp={stamp.text}
            stampTone={stamp.tone}
            className={cn(expired && "border-2 border-dashed")}
            data={{
              need: [
                tService(request.role as "PHOTOGRAPHER"),
                request.categories.map((c) => categoryT(c)).join(", "),
              ]
                .filter(Boolean)
                .join(" · "),
              when,
              where: [request.ward, request.province, request.areaNote]
                .filter(Boolean)
                .join("\n"),
              style:
                request.references.length > 0
                  ? t("refCount", { count: request.references.length })
                  : undefined,
              budget:
                formatBudgetRange(request.budgetMin, request.budgetMax) ??
                t("budgetNotSet"),
              note: request.description ?? undefined,
            }}
          />
          {request.references.length > 0 ? (
            <ReferenceMediaGallery
              urls={request.references.map((ref) => ref.mediaUrl)}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {expired || status === "CANCELLED" ? (
              <Button
                variant="accent"
                nativeButton={false}
                render={<Link href={`/requests/new?copy=${request.id}`} />}
              >
                {t("repost")}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                disabled={isCancelling}
                onClick={cancelRequest}
              >
                {isCancelling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {t("cancelRequest")}
              </Button>
            ) : null}
          </div>
        </aside>
      </div>

      {compareIds.length > 0 ? (
        <div
          role="region"
          aria-label={t("trayLabel")}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-full border border-border-default bg-surface-card py-2 pr-2 pl-5 shadow-[var(--shadow-lg)]"
        >
          <span className="flex-1 text-body-sm text-text-primary">
            {t("trayCount", { count: compareIds.length, max: MAX_COMPARE })}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setCompareIds([])}>
            {t("trayClear")}
          </Button>
          <Button
            variant="accent"
            size="sm"
            disabled={compareIds.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            {t("trayOpen")}
          </Button>
        </div>
      ) : null}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t("compareTitle", { count: comparing.length })}
            </DialogTitle>
          </DialogHeader>
          {/* On a phone the table scrolls sideways, snapping column by
              column, while the label column stays put. */}
          <div className="-mx-5 snap-x snap-mandatory overflow-x-auto px-5">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-body-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-28 bg-surface-card" />
                  {comparing.map((offer) => (
                    <th
                      key={offer.id}
                      scope="col"
                      className="min-w-[200px] snap-start border-b border-border-default px-3 pb-3 align-bottom"
                    >
                      <span className="flex items-center gap-1.5 text-body-md font-semibold! text-text-primary">
                        <span className="truncate">{offer.provider.name}</span>
                        {offer.provider.verified ? (
                          <BadgeCheck
                            aria-label={t("verified")}
                            className="size-4 shrink-0 text-brand-primary"
                          />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["price", (o: OfferView) => priceLine(o)],
                    [
                      "date",
                      (o: OfferView) =>
                        o.proposedDate
                          ? formatDate(o.proposedDate)
                          : t("proposedDateNone"),
                    ],
                    ["rating", (o: OfferView) => ratingLine(o)],
                    ["samples", (o: OfferView) => samples(o, "table")],
                    [
                      "message",
                      (o: OfferView) =>
                        o.message ? (
                          <span className="line-clamp-6 whitespace-pre-line text-text-secondary">
                            {o.message}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        ),
                    ],
                  ] as const
                ).map(([key, cell]) => (
                  <tr key={key}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-border-subtle bg-surface-card py-3 pr-3 align-top font-semibold! text-text-secondary"
                    >
                      {t(`compareRows.${key}`)}
                    </th>
                    {comparing.map((offer) => (
                      <td
                        key={offer.id}
                        className="snap-start border-b border-border-subtle px-3 py-3 align-top text-text-primary"
                      >
                        {cell(offer)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-card" />
                  {comparing.map((offer) => (
                    <td key={offer.id} className="px-3 pt-4">
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => openAccept(offer)}
                      >
                        {t("accept")}
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={acceptingOffer !== null}
        onOpenChange={(open) => !open && setAcceptingOffer(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("acceptDialogTitle")}</DialogTitle>
          </DialogHeader>
          {acceptingOffer ? (
            <p className="text-body-sm text-text-secondary">
              {t("acceptDialogBody", {
                name: acceptingOffer.provider.name,
                price: formatCurrency(acceptingOffer.proposedPrice),
              })}
            </p>
          ) : null}
          <div className="flex flex-col gap-3">
            <DateField
              label={t("acceptDateLabel")}
              value={acceptDate}
              onChange={setAcceptDate}
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

/** The artist's message, three lines until opened. */
function OfferMessage({ text }: { text: string }) {
  const t = useTranslations("dashboardCore.serviceRequests.detail");
  const [open, setOpen] = useState(false);
  const long = text.length > 180 || text.split("\n").length > 3;
  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className={cn(
          "text-body-md whitespace-pre-line text-text-secondary",
          !open && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring rounded-[var(--fg-radius-sm)] text-body-sm font-semibold! text-text-link"
        >
          {open ? t("showLess") : t("showMore")}
        </button>
      ) : null}
    </div>
  );
}
