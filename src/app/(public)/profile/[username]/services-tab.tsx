"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  editedPhotoCount?: number | null;
  deliveryDays?: number | null;
}

// Package cards (redesign 09/2026): name, what it delivers, the price and
// "Chọn gói", which opens the booking flow with the package chosen. The
// design's "Thời lượng" row is left out on purpose: providers stopped
// setting a duration on 21/09/2026 (project owner) and describe timing in
// the description instead, so the stored value is only a calendar default.
export function ServicesTab({
  services,
  onBook,
  onMessage,
  offersTfp,
  isOwnProfile,
}: {
  services: ServiceItem[];
  onBook: (serviceId: string) => void;
  onMessage: () => void;
  offersTfp?: boolean;
  isOwnProfile: boolean;
}) {
  const t = useTranslations("publicPages.profile.servicesTab");

  if (services.length === 0) {
    return (
      <EmptyState
        title={t("empty")}
        description={isOwnProfile ? undefined : t("emptyHint")}
        primaryAction={
          isOwnProfile ? undefined : (
            <Button size="sm" variant="outline" onClick={onMessage}>
              {t("askForQuote")}
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {offersTfp ? (
        <Badge variant="accent" className="w-fit">
          {t("tfpAvailable")}
        </Badge>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => {
          const facts = [
            service.editedPhotoCount != null
              ? {
                  label: t("editedPhotos"),
                  value: t("photoCount", { count: service.editedPhotoCount }),
                }
              : null,
            service.deliveryDays != null
              ? {
                  label: t("delivery"),
                  value: t("afterDays", { count: service.deliveryDays }),
                }
              : null,
          ].filter(Boolean) as { label: string; value: string }[];
          return (
            <li
              key={service.id}
              className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5 transition-[border-color,box-shadow] duration-[var(--fg-dur-260)] hover:border-border-strong hover:shadow-[var(--shadow-md)]"
            >
              <h3 className="line-clamp-2 text-heading-sm text-text-primary">
                {service.name}
              </h3>
              {facts.length > 0 ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-sm">
                  {facts.map((fact) => (
                    <div key={fact.label} className="contents">
                      <dt className="text-text-tertiary">{fact.label}</dt>
                      <dd className="font-semibold! text-text-primary">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {service.description ? (
                <p className="line-clamp-4 text-body-sm whitespace-pre-line [overflow-wrap:anywhere] text-text-secondary">
                  {service.description}
                </p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
                <span className="font-mono text-body-md font-semibold! tabular-nums text-text-primary">
                  {service.price === 0
                    ? t("tfpCollab")
                    : t("from", {
                        price: formatCurrency(service.price, service.currency),
                      })}
                </span>
                {isOwnProfile ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onBook(service.id)}
                  >
                    {t("choose")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
