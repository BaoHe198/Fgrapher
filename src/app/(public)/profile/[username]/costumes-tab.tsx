"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { formatCurrency } from "@/lib/utils";
import { vietnamDateKey } from "@/lib/vietnam/date";

export interface PublicCostume {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  rentalPricePerDay: number;
  depositAmount: number | null;
  size: string | null;
  color: string | null;
  media: { url: string } | null;
}

export function CostumesTab({
  costumes,
  shopUserId,
  isOwnProfile,
}: {
  costumes: PublicCostume[];
  shopUserId: string;
  isOwnProfile: boolean;
}) {
  const t = useTranslations("publicPages.profile.costumesTab");
  const categoryT = useTranslations("profileCategory");
  const router = useRouter();
  // The outfit being asked about, and the dates the customer has in mind.
  // The message used to be written with a blank in it ("vào ngày …") that
  // people sent as it was (role walk-through, 25/11/2026).
  const [asking, setAsking] = useState<PublicCostume | null>(null);
  const [from, setFrom] = useState("");
  const [days, setDays] = useState("1");
  const today = vietnamDateKey();
  const dayCount = Math.min(Math.max(Math.round(Number(days)) || 1, 1), 60);

  const openAsk = (costume: PublicCostume) => {
    setAsking(costume);
    setFrom("");
    setDays("1");
  };

  // Nothing is sent from here: this opens the chat with the message
  // written, and the customer presses send there.
  const compose = (withDates: boolean) => {
    if (!asking) return;
    const params = new URLSearchParams({
      to: shopUserId,
      costume: asking.id,
      costumeName: asking.name,
      // What tells this outfit from the shop's others when names are close.
      costumeInfo: [
        t("perDay", { price: formatCurrency(asking.rentalPricePerDay) }),
        asking.size,
        asking.color,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    if (withDates && from) {
      params.set("rentFrom", from.split("-").reverse().join("/"));
      params.set("rentDays", String(dayCount));
    }
    setAsking(null);
    router.push(`/dashboard/messages?${params.toString()}`);
  };

  if (costumes.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-text-tertiary">{t("note")}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {costumes.map((costume) => (
          // h-full + flex-1 + mt-auto: outfits list different amounts of
          // detail (a deposit, a size, a description — or none), which left
          // each card's "message to rent" button at a different height.
          <div key={costume.id} className="flex h-full flex-col gap-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--fg-radius-md)]">
              {costume.media ? (
                <Image
                  src={costume.media.url}
                  alt={costume.name}
                  fill
                  sizes="(min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              ) : (
                // Neutral, labelled — the brand green block read as a
                // broken image rather than as "no photo yet".
                <MediaPlaceholder
                  tint="neutral-200"
                  height="100%"
                  label={t("noPhoto")}
                />
              )}
              {costume.category ? (
                <div className="absolute left-2 top-2">
                  <Badge variant="neutral">{categoryT(costume.category)}</Badge>
                </div>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-body-md font-semibold! text-text-primary">
                {costume.name}
              </p>
              <p className="text-body-sm text-text-primary">
                {t("perDay", {
                  price: formatCurrency(costume.rentalPricePerDay),
                })}
              </p>
              {costume.depositAmount ? (
                <p className="text-body-sm text-text-secondary">
                  {t("deposit", {
                    amount: formatCurrency(costume.depositAmount),
                  })}
                </p>
              ) : null}
              {costume.size || costume.color ? (
                <p className="text-body-sm text-text-tertiary">
                  {[costume.size, costume.color].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {costume.description ? (
                <p className="line-clamp-2 text-body-sm text-text-secondary">
                  {costume.description}
                </p>
              ) : null}
              {/* Renting is agreed in the chat — dates, price and deposit are
                  between the customer and the shop, not on a calendar
                  (project owner, 22/09/2026). The message is prefilled with
                  the outfit, but the customer still presses send. */}
              {isOwnProfile ? null : (
                <div className="mt-auto pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => openAsk(costume)}
                  >
                    <MessageCircle className="size-4" />
                    {t("messageToRent")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ask.title")}</DialogTitle>
            <DialogDescription>{t("ask.description")}</DialogDescription>
          </DialogHeader>
          {asking ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {asking.media ? (
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-[var(--fg-radius-md)]">
                    <Image
                      src={asking.media.url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-col">
                  <span className="text-body-md font-semibold! text-text-primary">
                    {asking.name}
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {t("perDay", {
                      price: formatCurrency(asking.rentalPricePerDay),
                    })}
                    {asking.depositAmount
                      ? ` · ${t("deposit", { amount: formatCurrency(asking.depositAmount) })}`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateField
                  label={t("ask.from")}
                  value={from}
                  min={today}
                  onChange={setFrom}
                />
                <Input
                  label={t("ask.days")}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
              {from ? (
                <p className="rounded-[var(--fg-radius-md)] bg-bg-sunken p-3 text-body-sm text-text-secondary">
                  {t("ask.estimate", {
                    days: dayCount,
                    total: formatCurrency(asking.rentalPricePerDay * dayCount),
                  })}
                  {asking.depositAmount
                    ? ` ${t("ask.estimateDeposit", { amount: formatCurrency(asking.depositAmount) })}`
                    : ""}{" "}
                  {t("ask.estimateNote")}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => compose(false)}>
              {t("ask.noDate")}
            </Button>
            <Button
              variant="accent"
              disabled={!from}
              onClick={() => compose(true)}
            >
              {t("ask.compose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
