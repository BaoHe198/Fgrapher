"use client";

import { BadgeCheck, CalendarCheck, MapPin, Star, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatVND } from "@/lib/format";
import type { FmapProviderPreview } from "@/services/fmap";

export function FmapProviderPreviewCard({
  preview,
  loading,
  bookingHref,
  onClose,
}: {
  preview: FmapProviderPreview | null;
  loading: boolean;
  bookingHref: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("fmap");
  const roleT = useTranslations("role");

  return (
    <aside className="absolute right-3 bottom-3 left-3 z-10 rounded-[var(--fg-radius-xl)] border border-border-default bg-bg-surface shadow-[var(--shadow-xl)] sm:top-3 sm:right-3 sm:bottom-auto sm:left-auto sm:w-[370px] max-h-[70%] overflow-y-auto">
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
      {loading || !preview ? (
        <div className="flex h-52 items-center justify-center text-body-md text-text-secondary">
          {t("preview.loading")}
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
            <div className="flex items-start gap-3">
              <Avatar className="size-12 border border-border-default">
                <AvatarImage src={preview.avatar ?? undefined} alt="" />
                <AvatarFallback>
                  {preview.displayName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1.5 text-title-md text-text-primary">
                  <span className="truncate">{preview.displayName}</span>
                  <BadgeCheck
                    className="size-4 shrink-0 text-success"
                    aria-label={t("preview.verified")}
                  />
                </h2>
                <p className="text-body-sm text-text-secondary">
                  {roleT(preview.role)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-gold-400 text-gold-500" />
                {preview.rating?.toFixed(1) ?? t("preview.newProvider")} (
                {preview.reviewCount})
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
              <p className="mt-2 line-clamp-2 text-body-sm text-text-secondary hidden sm:block">
                {preview.description}
              </p>
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
