"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  currency: string;
}

export function ServicesTab({
  services,
  onBook,
  offersTfp,
  isOwnProfile,
}: {
  services: ServiceItem[];
  onBook: (serviceId: string) => void;
  offersTfp?: boolean;
  isOwnProfile: boolean;
}) {
  const t = useTranslations("publicPages.profile.servicesTab");

  function formatDuration(minutes: number) {
    if (minutes < 60) return t("durationMinutes", { count: minutes });
    const hours = minutes / 60;
    return t("durationHours", {
      count: hours % 1 === 0 ? hours : hours.toFixed(1),
    });
  }

  if (services.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {offersTfp ? (
        <Badge variant="accent" className="w-fit">
          {t("tfpAvailable")}
        </Badge>
      ) : null}
      {services.map((service) => (
        // Stacked on phones, side-by-side from `sm` up. It used to be a row at
        // every width: on a 390px screen the price and button took ~180px, so
        // a package description was squeezed into ~170px and wrapped every two
        // or three words. The text column also had no `min-w-0`, so instead of
        // shrinking it overflowed and ran underneath the price.
        <div
          key={service.id}
          className="flex flex-col gap-4 rounded-[var(--fg-radius-md)] bg-surface-card p-[18px] shadow-[var(--shadow-sm)] sm:flex-row sm:items-start sm:justify-between sm:gap-6"
        >
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="text-heading-sm text-text-primary">
              {service.name}
            </span>
            {service.description ? (
              <p className="whitespace-pre-line text-body-sm leading-relaxed text-text-secondary">
                {service.description}
              </p>
            ) : null}
            <span className="rounded-full bg-bg-sunken px-2.5 py-0.5 text-body-sm text-text-tertiary">
              {formatDuration(service.duration)}
            </span>
          </div>
          {/* Phones: price left, button right on their own row under the text.
              From `sm`: back beside the text, top-aligned — `items-center`
              floated the price into the middle of a long description. */}
          <div className="flex shrink-0 items-center justify-between gap-3.5 sm:justify-end">
            <span className="text-heading-sm text-text-primary">
              {service.price === 0
                ? t("tfpCollab")
                : formatCurrency(service.price, service.currency)}
            </span>
            {isOwnProfile ? null : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onBook(service.id)}
              >
                {t("book")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
