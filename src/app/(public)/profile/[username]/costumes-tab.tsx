import Image from "next/image";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
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

export function CostumesTab({ costumes }: { costumes: PublicCostume[] }) {
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
          <div key={costume.id} className="flex flex-col gap-2">
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
                <MediaPlaceholder tint="green-300" height="100%" />
              )}
              {costume.category ? (
                <div className="absolute left-2 top-2">
                  <Badge variant="neutral">{categoryT(costume.category)}</Badge>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5">
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
