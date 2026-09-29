"use client";

import * as React from "react";
import { BadgeCheck, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The booking summary column (system audit 09/2026 §05): who, then one row
// per choice with its own "Sửa" link back to that step, the expected total,
// and a fixed reminder that nothing is paid online - money changes hands
// directly with the provider in this MVP (CLAUDE.md, no online payment).

export interface BookingSummaryRow {
  label: string;
  /** null renders the "not chosen yet" placeholder. */
  value: React.ReactNode | null;
  sub?: React.ReactNode;
  onEdit?: () => void;
}

interface BookingSummaryProps {
  provider: {
    name: string;
    avatarUrl?: string | null;
    rating?: number | null;
    reviewCount?: number;
    verified?: boolean;
  };
  rows: BookingSummaryRow[];
  /** Formatted, e.g. "5.500.000₫", or null for "Báo giá sau". */
  total: string | null;
  totalNote?: React.ReactNode;
  /** e.g. "Nghệ sĩ phản hồi trong 2 giờ". */
  responseNote?: React.ReactNode;
  editable?: boolean;
  loading?: boolean;
  className?: string;
}

export function BookingSummary({
  provider,
  rows,
  total,
  totalNote,
  responseNote,
  editable = true,
  loading = false,
  className,
}: BookingSummaryProps) {
  const t = useTranslations("uiKit.bookingSummary");
  return (
    <section
      aria-label={t("label")}
      data-slot="booking-summary"
      className={cn(
        "flex flex-col gap-5 rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-6 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="size-12">
          {provider.avatarUrl ? (
            <AvatarImage src={provider.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback>
            {provider.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-heading-sm text-text-primary">
            {provider.name}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-meta text-text-tertiary">
            {provider.rating ? (
              <span className="flex items-center gap-1">
                <Star
                  aria-hidden
                  className="size-3 fill-gold-400 text-gold-400"
                />
                {provider.rating.toFixed(1).replace(".", ",")}
                {provider.reviewCount ? ` (${provider.reviewCount})` : null}
              </span>
            ) : null}
            {provider.verified ? (
              <span className="flex items-center gap-1">
                <BadgeCheck aria-hidden className="size-3 text-brand-primary" />
                {t("verified")}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <dl className="flex flex-col border-t border-border-subtle">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[88px_1fr_auto] items-baseline gap-3 border-b border-border-subtle py-3.5"
          >
            <dt className="text-body-sm text-text-tertiary">{row.label}</dt>
            <dd className="flex min-w-0 flex-col">
              {loading ? (
                <Skeleton className="h-4 w-28" />
              ) : row.value ? (
                <span className="text-body-sm font-semibold! break-words text-text-primary">
                  {row.value}
                </span>
              ) : (
                <span className="text-body-sm text-text-tertiary">
                  {t("notChosen")}
                </span>
              )}
              {row.sub && !loading ? (
                <span className="text-meta text-text-tertiary">{row.sub}</span>
              ) : null}
            </dd>
            {editable && row.onEdit ? (
              <button
                type="button"
                onClick={row.onEdit}
                aria-label={t("editRow", { row: row.label })}
                className="focus-ring rounded-[4px] text-body-sm font-semibold! text-text-link underline underline-offset-4 hover:text-text-primary"
              >
                {t("edit")}
              </button>
            ) : (
              <span aria-hidden />
            )}
          </div>
        ))}
      </dl>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-heading-sm text-text-primary">
            {t("total")}
          </span>
          {totalNote ? (
            <span className="text-meta text-text-tertiary">{totalNote}</span>
          ) : null}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <span className="font-mono text-heading-md font-semibold! tabular-nums text-text-primary">
            {total ?? t("quoteLater")}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] bg-bg-sunken p-4 text-body-sm text-text-secondary">
        <li className="flex gap-2">
          <span
            aria-hidden
            className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-400"
          />
          <span>
            <strong className="font-semibold text-text-primary">
              {t("noOnlinePayment")}
            </strong>{" "}
            {t("noOnlinePaymentDetail")}
          </span>
        </li>
        {responseNote ? (
          <li className="flex gap-2">
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-400"
            />
            <span>{responseNote}</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
