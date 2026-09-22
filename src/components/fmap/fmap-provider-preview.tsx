"use client";

import { BadgeCheck, CalendarCheck, MapPin, Star, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { serviceKindsForRole } from "@/lib/constants/service-matrix";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
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
}

export function FmapProviderPreviewCard({
  preview,
  loading,
  error,
  onRetry,
  bookingHref,
  onClose,
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
    <aside className="absolute right-3 bottom-3 left-3 z-10 max-h-[70%] overflow-y-auto rounded-[var(--fg-radius-xl)] border border-border-default bg-bg-surface shadow-[var(--shadow-xl)] sm:top-3 sm:right-3 sm:bottom-auto sm:left-auto sm:max-h-[calc(100%-1.5rem)] sm:w-[370px]">
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={t("preview.close")}
        className="absolute top-3 right-3 z-10 rounded-full"
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
          {preview.coverUrl ? (
            <div className="relative hidden h-36 w-full bg-bg-sunken sm:block">
              <Image
                src={preview.coverUrl}
                alt=""
                fill
                sizes="370px"
                className="object-cover"
              />
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
                <h2 className="flex min-w-0 items-center gap-1.5 text-title-md text-text-primary">
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
