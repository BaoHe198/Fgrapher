import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { formatCurrency } from "@/lib/utils";

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
                    nativeButton={false}
                    render={
                      <Link
                        href={`/dashboard/messages?to=${shopUserId}&costume=${costume.id}&costumeName=${encodeURIComponent(costume.name)}`}
                      />
                    }
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
    </div>
  );
}
