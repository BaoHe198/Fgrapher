"use client";

import { BadgeCheck, CalendarCheck, MapPin, Star, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { serviceKindsForRole } from "@/lib/constants/service-matrix";
import Link from "next/link";
import { useEffect } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FmapProviderPreview } from "@/services/fmap";

interface FmapProviderPreviewCardProps {
  preview: FmapProviderPreview | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  bookingHref: string | null;
  onClose: () => void;
  /** Phones: drawn inside the results sheet instead of floating. */
  inline?: boolean;
}

export function FmapProviderPreviewCard({
  preview,
  loading,
  error,
  onRetry,
  bookingHref,
  onClose,
  inline = false,
}: FmapProviderPreviewCardProps) {
  const t = useTranslations("fmap");
  const roleT = useTranslations("role");
  const serviceKindT = useTranslations("serviceKind");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    // Phones: inside the results sheet (Core MVP pass). Larger screens: a
    // floating card on the right. Enters with fade + rise 6px.
    <aside
      className={cn(
        "relative animate-page-in",
        inline
          ? "bg-bg-surface"
          : "absolute top-3 right-3 z-20 max-h-[calc(100%-1.5rem)] w-[370px] overflow-y-auto rounded-[var(--fg-radius-xl)] border border-border-subtle bg-surface-card shadow-[var(--shadow-lg)]",
      )}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={t("preview.close")}
        className="absolute top-2 right-2 z-10 size-11 rounded-full"
        onClick={onClose}
      >
        <X />
      </Button>

      {error ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="text-body-md text-text-secondary">
            {t("preview.error")}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            {t("preview.retry")}
          </Button>
        </div>
      ) : loading || !preview ? (
        <div className="space-y-3 p-4 pr-14">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-full" />
          <span className="sr-only">{t("preview.loading")}</span>
        </div>
      ) : (
        <>
          {/* Three frames from their newest work, not one cover: a
              customer judges an artist across several photos (audit §06).
              Shown on phones too, as a short strip. */}
          {preview.photoUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 p-1 pb-0">
              {preview.photoUrls.slice(0, 3).map((url, index) => (
                <FgImage
                  key={url}
                  src={url}
                  alt=""
                  ratio="1/1"
                  rounded="sm"
                  revealIndex={index}
                  sizes="124px"
                  className="max-sm:aspect-[4/3]"
                />
              ))}
            </div>
          ) : null}
          <div className="p-4">
            <div className="flex items-start gap-3 pr-10">
              <Avatar className="size-12 border border-border-default">
                <AvatarImage src={preview.avatar ?? undefined} alt="" />
                <AvatarFallback>
                  {preview.displayName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="flex min-w-0 items-center gap-1.5 text-heading-sm text-text-primary">
                  <span className="truncate">{preview.displayName}</span>
                  <BadgeCheck
                    className="size-4 shrink-0 text-success"
                    aria-label={t("preview.verified")}
                  />
                </h2>
                <p className="text-body-sm text-text-secondary">
                  {/* Role, then anything extra they can be hired for: a
                      studio that also shoots says so here rather than
                      looking like a bare room for rent. */}
                  {[
                    roleT(preview.role),
                    ...(preview.serviceKinds ?? [])
                      .filter(
                        (kind) => serviceKindsForRole(preview.role)[0] !== kind,
                      )
                      .map((kind) => serviceKindT(kind)),
                  ].join(" · ")}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-gold-400 text-gold-500" />
                {preview.reviewCount === 0 || preview.rating == null
                  ? t("preview.newProvider")
                  : `${preview.rating.toFixed(1)} (${preview.reviewCount})`}
              </span>
              {preview.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" /> {preview.location}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-[var(--fg-radius-md)] bg-gold-50 px-3 py-2 text-neutral-900 dark:bg-gold-900/30 dark:text-gold-100">
              <span className="text-body-sm">{t("preview.startingPrice")}</span>
              <strong>
                {preview.startingPrice != null
                  ? formatVND(preview.startingPrice)
                  : t("preview.contact")}
              </strong>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-body-sm font-semibold text-success">
              <CalendarCheck className="size-4" /> {t("preview.available")}
            </p>

            {preview.description ? (
              <p className="mt-2 hidden text-body-sm text-text-secondary sm:line-clamp-2">
                {preview.description}
              </p>
            ) : null}

            {preview.services.length > 0 ? (
              <ul className="mt-3 hidden space-y-1 text-body-sm sm:block">
                {preview.services.map((service) => (
                  <li key={service.id} className="flex justify-between gap-3">
                    <span className="truncate text-text-secondary">
                      {service.name}
                    </span>
                    <span className="shrink-0 font-semibold text-text-primary">
                      {formatVND(service.price)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {preview.username ? (
                <Link
                  href={`/profile/${preview.username}`}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "md" }),
                    "w-full",
                  )}
                >
                  {t("preview.viewProfile")}
                </Link>
              ) : (
                <span />
              )}
              {bookingHref ? (
                <Link
                  href={bookingHref}
                  className={cn(
                    buttonVariants({ variant: "accent", size: "md" }),
                    "w-full",
                  )}
                >
                  {t("preview.book")}
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
