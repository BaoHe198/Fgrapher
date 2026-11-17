"use client";

import { Check, Clock, Images } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

export interface LinkService {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: number;
  editedPhotoCount: number | null;
  deliveryDays: number | null;
}

interface LinkPackagesProps {
  services: LinkService[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  callName: string;
  /** Message link for "ask for a price" when there are no packages. */
  askHref: string;
  /** The viewer is the provider: cards show, choosing does not. */
  readOnly: boolean;
}

// Step 2: the price list, as cards a customer can compare and pick. Every
// card answers the same questions in the same order - the price, how many
// edited photos, how soon they arrive - so two packages read side by side.
// No duration row: providers describe timing in the description, and the
// stored minutes are only a calendar default (see services-tab.tsx).
// Picking one carries it into "what you get" and the calendar below.
export function LinkPackages({
  services,
  selectedId,
  onSelect,
  callName,
  askHref,
  readOnly,
}: LinkPackagesProps) {
  const t = useTranslations("linkPage.packages");

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--fg-radius-lg)] border border-dashed border-border-strong bg-bg-surface p-5">
        <p className="text-body-md text-text-primary">
          {t("emptyTitle", { name: callName })}
        </p>
        <p className="text-body-sm text-text-secondary">{t("emptyBody")}</p>
        {readOnly ? null : (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={askHref} />}
          >
            {t("askPrice")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const selected = service.id === selectedId;
          const facts = [
            service.editedPhotoCount != null
              ? {
                  icon: Images,
                  text: t("photos", { count: service.editedPhotoCount }),
                }
              : null,
            service.deliveryDays != null
              ? {
                  icon: Clock,
                  text: t("delivery", { count: service.deliveryDays }),
                }
              : null,
          ].filter(Boolean) as { icon: typeof Images; text: string }[];
          return (
            <li
              key={service.id}
              className={cn(
                "flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border bg-bg-surface p-5 transition-[border-color,box-shadow] duration-[var(--fg-dur-260)]",
                selected
                  ? "border-gold-600 shadow-[var(--shadow-md)] ring-1 ring-gold-600 dark:border-gold-400 dark:ring-gold-400"
                  : "border-border-subtle hover:border-border-strong",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 text-heading-sm text-text-primary">
                  {service.name}
                </h3>
                {selected ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-meta font-semibold! text-gold-800 dark:bg-gold-900/40 dark:text-gold-200">
                    <Check aria-hidden className="size-3" />
                    {t("chosen")}
                  </span>
                ) : null}
              </div>
              <span className="text-heading-md font-semibold! tabular-nums text-text-primary">
                {service.price === 0
                  ? t("tfp")
                  : t("from", {
                      price: formatCurrency(service.price, service.currency),
                    })}
              </span>
              {facts.length > 0 ? (
                <ul className="flex flex-col gap-1.5 text-body-sm text-text-secondary">
                  {facts.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-2">
                      <Icon
                        aria-hidden
                        className="size-4 shrink-0 text-text-tertiary"
                      />
                      {text}
                    </li>
                  ))}
                </ul>
              ) : null}
              {service.description ? (
                <p className="line-clamp-4 text-body-sm whitespace-pre-line [overflow-wrap:anywhere] text-text-secondary">
                  {service.description}
                </p>
              ) : null}
              {readOnly ? null : (
                <Button
                  variant={selected ? "accent" : "outline"}
                  size="sm"
                  className="mt-auto w-full"
                  aria-pressed={selected}
                  onClick={() => onSelect(service.id)}
                >
                  {selected ? t("pickDate") : t("choose")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-meta text-text-tertiary">
        {t("finalPriceNote", { name: callName })}
      </p>
    </div>
  );
}
