import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { FgImage } from "@/components/ui/fg-image";
import { monthsLabel } from "@/components/places/months-label";
import type { PlaceCard as PlaceCardData } from "@/services/places";

interface PlaceCardProps {
  place: PlaceCardData;
  /** The first cards on a page load eagerly. */
  priority?: boolean;
  /** Hide the province when the page is already about one. */
  showProvince?: boolean;
}

/** One photo spot in a grid: its cover, name, kind, area and best months. */
export function PlaceCard({
  place,
  priority = false,
  showProvince = true,
}: PlaceCardProps) {
  const t = useTranslations("places");
  const area = [place.wardName, showProvince ? place.provinceName : null]
    .filter(Boolean)
    .join(", ");
  const months = monthsLabel(place.bestMonths, t);

  return (
    <Link
      href={place.href}
      className="group/place focus-ring flex min-w-0 flex-col gap-2.5 rounded-[var(--fg-radius-md)]"
    >
      <FgImage
        src={place.coverUrl}
        alt=""
        ratio="4/3"
        rounded="md"
        priority={priority}
        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
        imageClassName="transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/place:scale-[1.03] motion-reduce:transition-none"
      >
        {place.operatingStatus !== "OPEN" ? (
          <Badge variant="warning" className="absolute top-2 left-2">
            {t(`status.${place.operatingStatus}`)}
          </Badge>
        ) : null}
      </FgImage>
      <span className="flex flex-col gap-1">
        <span className="text-heading-sm [overflow-wrap:anywhere] text-text-primary group-hover/place:underline group-hover/place:underline-offset-4">
          {place.name}
        </span>
        <span className="text-body-sm text-text-secondary">
          {t(`kinds.${place.kind}`)}
          {area ? (
            <>
              {" · "}
              <MapPin
                aria-hidden
                className="inline size-3.5 align-[-2px]"
              />{" "}
              {area}
            </>
          ) : null}
        </span>
        <span className="text-meta text-text-tertiary">
          {[months, t("card.albums", { count: place.albumCount })]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}
