"use client";

import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/ui/star-rating";
import { avatarFallbackColor, cn } from "@/lib/utils";

const MAX_VISIBLE_ROLES = 2;
const SWIPE_THRESHOLD_PX = 40;

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
    username: string;
    roles: string[];
    city: string;
    rating: string | number;
    reviews: number;
    price: string;
    avatar?: string;
    media: { url: string; type: string }[];
    // Prompt B4 VIỆC 4 — set only by the browse page's nationwide backfill
    // section, so those cards carry a visible "accepts nationwide
    // bookings" label distinguishing them from a province-matched result.
    nationwideLabel?: string;
  };
  onClick?: () => void;
}

export function ArtistCard({ artist, onClick }: ArtistCardProps) {
  const t = useTranslations("sharedComponents.artistCard");
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);

  const photos = artist.media.slice(0, 5);
  const hasPhotos = photos.length > 0;
  const initial = artist.name[0]?.toUpperCase() ?? "?";
  const visibleRoles = artist.roles.slice(0, MAX_VISIBLE_ROLES);
  const extraRoleCount = artist.roles.length - visibleRoles.length;

  const goTo = (index: number) => {
    setActiveIndex(((index % photos.length) + photos.length) % photos.length);
  };

  const stopAndGo = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(index);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    goTo(delta < 0 ? activeIndex + 1 : activeIndex - 1);
  };

  return (
    <Link href={`/profile/${artist.username}`} onClick={onClick}>
      <Card
        padding={false}
        className="group cursor-pointer overflow-hidden transition-shadow duration-150 hover:shadow-[var(--shadow-md)]"
      >
        <div
          className="relative aspect-[3/4] w-full bg-bg-sunken"
          onTouchStart={hasPhotos ? onTouchStart : undefined}
          onTouchEnd={hasPhotos ? onTouchEnd : undefined}
        >
          {hasPhotos ? (
            <>
              {photos[activeIndex].type === "VIDEO" ? (
                <video
                  src={photos[activeIndex].url}
                  className="size-full object-cover"
                  muted
                />
              ) : (
                <Image
                  src={photos[activeIndex].url}
                  alt={artist.name}
                  fill
                  className="object-cover"
                />
              )}

              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => stopAndGo(e, activeIndex - 1)}
                    aria-label={t("previousPhoto")}
                    className="absolute top-1/2 left-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => stopAndGo(e, activeIndex + 1)}
                    aria-label={t("nextPhoto")}
                    className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.url}
                        type="button"
                        onClick={(e) => stopAndGo(e, index)}
                        aria-label={t("viewPhoto", { index: index + 1 })}
                        className={cn(
                          "size-1.5 rounded-full bg-white/60 transition-colors duration-150",
                          index === activeIndex && "bg-white",
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div
              className="flex size-full items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--green-900), var(--green-500) 60%, var(--gold-300))",
              }}
            >
              <Avatar className="size-[64px] border-2 border-white/50">
                {artist.avatar ? (
                  <AvatarImage src={artist.avatar} alt={artist.name} />
                ) : null}
                <AvatarFallback
                  className={cn(
                    "text-heading-md text-white",
                    avatarFallbackColor(artist.name),
                  )}
                >
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-caption text-white/80">
                {t("noPhotoLabel")}
              </span>
            </div>
          )}

          {artist.nationwideLabel ? (
            <Badge variant="neutral" className="absolute top-2 left-2">
              {artist.nationwideLabel}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 p-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* Prompt G5, VIỆC 2 — placed next to the name rather than
                overlapping the image, since the carousel's dot indicators
                already occupy the image's bottom-center and a "no photo"
                card already shows a large centered avatar of its own. */}
            <Avatar size="sm" className="shrink-0 border-2 border-bg-surface">
              {artist.avatar ? (
                <AvatarImage src={artist.avatar} alt={artist.name} />
              ) : null}
              <AvatarFallback
                className={cn("text-white", avatarFallbackColor(artist.name))}
              >
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="line-clamp-2 min-h-[2.5rem] min-w-0 flex-1 text-heading-sm font-semibold! text-text-primary">
              {artist.name}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {visibleRoles.map((role) => (
              <Badge key={role} variant="accent">
                {role}
              </Badge>
            ))}
            {extraRoleCount > 0 ? (
              <Badge variant="neutral">+{extraRoleCount}</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-1 text-body-sm text-text-secondary">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{artist.city}</span>
          </div>

          <StarRating
            rating={artist.rating}
            reviews={artist.reviews}
            hideCountWhenZero
          />

          <span className="text-body-md font-semibold! text-text-primary">
            {artist.price}
          </span>
        </div>
      </Card>
    </Link>
  );
}
