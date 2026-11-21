"use client";

import { ArrowRight, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { monthsLabel } from "@/components/places/months-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { cn } from "@/lib/utils";
import type { PlaceCard } from "@/services/places";

/** A photo spot chosen on Fmap: its cover, facts at a glance, its page. */
export function FmapPlacePreview({
  place,
  onClose,
  inline = false,
}: {
  place: PlaceCard;
  onClose: () => void;
  /** Inside the phone sheet rather than floating over the map. */
  inline?: boolean;
}) {
  const t = useTranslations("places");
  const fmapT = useTranslations("places.fmap");
  const months = monthsLabel(place.bestMonths, t);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section
      aria-label={place.name}
      className={cn(
        "flex flex-col gap-3 p-4",
        inline
          ? "relative"
          : "absolute top-3 right-3 z-20 w-[340px] rounded-[var(--fg-radius-xl)] border border-border-subtle bg-surface-card shadow-[var(--shadow-lg)]",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={fmapT("close")}
        className="absolute top-2 right-2 z-10 size-11 rounded-full"
        onClick={onClose}
      >
        <X />
      </Button>
      <div className={cn("flex gap-3", inline ? "pr-10" : "flex-col")}>
        <div className={inline ? "w-28 shrink-0" : "w-full"}>
          <FgImage
            src={place.coverUrl}
            alt=""
            ratio="4/3"
            rounded="md"
            sizes={inline ? "112px" : "340px"}
          />
        </div>
        <div className={cn("flex min-w-0 flex-col gap-1", !inline && "pr-8")}>
          <p className="text-heading-sm [overflow-wrap:anywhere] text-text-primary">
            {place.name}
          </p>
          <p className="flex items-center gap-1 text-body-sm text-text-secondary">
            <MapPin aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">
              {t(`kinds.${place.kind}`)} · {place.provinceName}
            </span>
          </p>
          <p className="text-meta text-text-tertiary">
            {[months, t("card.albums", { count: place.albumCount })]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {place.operatingStatus !== "OPEN" ? (
            <Badge variant="warning">
              {t(`status.${place.operatingStatus}`)}
            </Badge>
          ) : null}
        </div>
      </div>
      <Button
        variant="primary"
        nativeButton={false}
        render={<Link href={place.href} />}
      >
        {fmapT("open")}
        <ArrowRight aria-hidden />
      </Button>
    </section>
  );
}
