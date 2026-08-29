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
}: {
  services: ServiceItem[];
  onBook: (serviceId: string) => void;
  offersTfp?: boolean;
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
        <div
          key={service.id}
          className="flex items-center justify-between rounded-[var(--fg-radius-md)] bg-surface-card p-[18px] shadow-[var(--shadow-sm)]"
        >
          <div className="flex flex-col gap-1">
            <span className="text-heading-sm text-text-primary">
              {service.name}
            </span>
            {service.description ? (
              <p className="text-body-sm text-text-secondary">
                {service.description}
              </p>
            ) : null}
            <span className="w-fit rounded-full bg-bg-sunken px-2.5 py-0.5 text-body-sm text-text-tertiary">
              {formatDuration(service.duration)}
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="text-heading-sm text-text-primary">
              {service.price === 0
                ? t("tfpCollab")
                : formatCurrency(service.price, service.currency)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onBook(service.id)}
            >
              {t("book")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
