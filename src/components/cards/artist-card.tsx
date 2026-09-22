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
type SlideDirection = -1 | 1;

interface ArtistCardProps {
  /** True for the first row of a grid — see the Image below. */
  priority?: boolean;
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

export function ArtistCard({ artist, onClick, priority }: ArtistCardProps) {
  const t = useTranslations("sharedComponents.artistCard");
  const [{ activeIndex, previousIndex, direction }, setCarousel] = useState<{
    activeIndex: number;
    previousIndex: number | null;
    direction: SlideDirection;
  }>({ activeIndex: 0, previousIndex: null, direction: 1 });
  // Tracks photo URLs that failed to load (e.g. a transient Cloudinary/
  // image-optimizer hiccup) so that slide falls back to the same "no
  // photo" treatment below instead of a bare broken-image icon.
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const touchStartX = useRef(0);

  const photos = artist.media.slice(0, 5);
  const hasPhotos = photos.length > 0;
  const activePhoto = photos[activeIndex];
  const previousPhoto =
    previousIndex === null ? undefined : photos[previousIndex];
  const initial = artist.name[0]?.toUpperCase() ?? "?";
  const visibleRoles = artist.roles.slice(0, MAX_VISIBLE_ROLES);
  const extraRoleCount = artist.roles.length - visibleRoles.length;

  const goTo = (index: number, requestedDirection?: SlideDirection) => {
    setCarousel((current) => {
      const nextIndex =
        ((index % photos.length) + photos.length) % photos.length;
      if (nextIndex === current.activeIndex) return current;

      return {
        activeIndex: nextIndex,
        previousIndex: current.activeIndex,
        direction:
          requestedDirection ?? (nextIndex > current.activeIndex ? 1 : -1),
      };
    });
  };

  const stopAndGo = (
    e: React.MouseEvent,
    index: number,
    requestedDirection?: SlideDirection,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(index, requestedDirection);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    goTo(delta < 0 ? activeIndex + 1 : activeIndex - 1, delta < 0 ? 1 : -1);
  };

  const renderPhoto = (photo: (typeof photos)[number]) => {
    if (failedUrls.has(photo.url)) {
      return (
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
        </div>
      );
    }

    if (photo.type === "VIDEO") {
      return <video src={photo.url} className="size-full object-cover" muted />;
    }

    return (
      <Image
        src={photo.url}
        alt={artist.name}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
        className="object-cover"
        // Set by the grid for the first row only: one of those images is the
        // LCP on /browse, and lazy-loading it costs the page its headline
        // metric for nothing.
        priority={priority}
        onError={() => setFailedUrls((prev) => new Set(prev).add(photo.url))}
      />
    );
  };

  return (
    // block + h-full on the link, flex column on the card: every card in a
    // grid row stretches to the tallest one and pins its price to the
    // bottom. A bare <Link> is inline, so the card inside it could never
    // fill the row, and one provider with a two-line name or an extra role
    // badge made their card visibly taller than its neighbours.
    <Link
      href={`/profile/${artist.username}`}
      onClick={onClick}
      className="block h-full"
    >
      <Card
        padding={false}
        interactive
        className="group flex h-full flex-col overflow-hidden"
      >
        <div
          className="relative aspect-[4/5] w-full bg-bg-sunken"
          onTouchStart={hasPhotos ? onTouchStart : undefined}
          onTouchEnd={hasPhotos ? onTouchEnd : undefined}
        >
          {hasPhotos ? (
            <>
              {previousPhoto ? (
                <div
                  key={`previous-${previousPhoto.url}`}
                  aria-hidden="true"
                  onAnimationEnd={() =>
                    setCarousel((current) =>
                      current.previousIndex === previousIndex
                        ? { ...current, previousIndex: null }
                        : current,
                    )
                  }
                  className={cn(
                    "absolute inset-0",
                    direction === 1
                      ? "fg-provider-slide-exit-next"
                      : "fg-provider-slide-exit-previous",
                  )}
                >
                  {renderPhoto(previousPhoto)}
                </div>
              ) : null}

              <div
                key={`active-${activePhoto.url}`}
                className={cn(
                  "absolute inset-0 z-10",
                  previousPhoto &&
                    (direction === 1
                      ? "fg-provider-slide-enter-next"
                      : "fg-provider-slide-enter-previous"),
                )}
              >
                {renderPhoto(activePhoto)}
              </div>

              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => stopAndGo(e, activeIndex - 1, -1)}
                    aria-label={t("previousPhoto")}
                    className="absolute top-1/2 left-2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-80 shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-[background-color,opacity,box-shadow] duration-200 hover:bg-black/60 hover:opacity-100 hover:shadow-[0_2px_8px_rgba(0,0,0,0.4)] focus-visible:opacity-100"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => stopAndGo(e, activeIndex + 1, 1)}
                    aria-label={t("nextPhoto")}
                    className="absolute top-1/2 right-2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-80 shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-[background-color,opacity,box-shadow] duration-200 hover:bg-black/60 hover:opacity-100 hover:shadow-[0_2px_8px_rgba(0,0,0,0.4)] focus-visible:opacity-100"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/25 px-2 py-1.5">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.url}
                        type="button"
                        onClick={(e) => stopAndGo(e, index)}
                        aria-label={t("viewPhoto", { index: index + 1 })}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full bg-white/60 transition-[width,background-color,opacity] duration-300 ease-out hover:bg-white/90",
                          index === activeIndex && "w-4 bg-white",
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
              // Quiet on purpose: a provider with no work yet should not
              // out-shout the ones with a portfolio. Was a saturated brand
              // gradient, which made every empty card the brightest tile
              // in the grid.
              style={{ background: "var(--bg-sunken)" }}
            >
              <Avatar className="size-[64px] border border-border-default">
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
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-caption text-text-tertiary">
                {t("noPhotoLabel")}
              </span>
            </div>
          )}

          {artist.nationwideLabel ? (
            <Badge variant="neutral" className="absolute top-2 left-2 z-20">
              {artist.nationwideLabel}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
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
            {/* min-h-[2lh]: always two lines' worth of height, whether the
                name needs one line or two (line-clamp-2 caps it there). Was a
                fixed 2.5rem, which is less than two lines of text-heading-sm
                (1.0625rem × 1.5 ≈ 3.19rem), so a wrapping name still pushed
                its card taller.

                The reserved height lives on this wrapper, not the text, and
                the wrapper carries text-heading-sm purely so `lh` resolves
                to the name's line-height (and can't drift from the type
                scale). items-center then centres a one-line name in the
                box — putting min-h on the span instead left short names at
                the top while the avatar beside them centred, so the two sat
                visibly out of line. */}
            <div className="flex min-h-[2lh] min-w-0 flex-1 items-center text-heading-sm">
              <span className="line-clamp-2 text-heading-sm font-semibold! text-text-primary">
                {artist.name}
              </span>
            </div>
          </div>

          {/* One row, never wrapping — a second row of badges is the other
              way a card got taller than its neighbours. Each role badge
              truncates on its own; the "+N" count must not, so it keeps
              shrink-0. */}
          <div className="flex min-w-0 flex-nowrap gap-1 overflow-hidden">
            {visibleRoles.map((role) => (
              // min-w-0 + truncate: Badge is shrink-0 by default, and a long
              // Vietnamese role name ("Chuyên viên trang điểm") overflowed
              // the card at two-column mobile widths, getting clipped
              // mid-word by the card's overflow-hidden.
              <Badge key={role} variant="accent" className="min-w-0 shrink">
                <span className="truncate">{role}</span>
              </Badge>
            ))}
            {extraRoleCount > 0 ? (
              <Badge variant="neutral" className="shrink-0">
                +{extraRoleCount}
              </Badge>
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

          <span className="mt-auto pt-1 text-body-md font-semibold! text-text-primary">
            {artist.price}
          </span>
        </div>
      </Card>
    </Link>
  );
}
