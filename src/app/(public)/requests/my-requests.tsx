"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface MyRequest {
  id: string;
  code: string;
  title: string;
  status: string;
  isDraft: boolean;
  /** "15/11/2026", or a flexible-date phrase, already formatted. */
  when: string;
  province: string;
  pendingOffers: number;
}

type Filter = "all" | "open" | "chosen" | "closed";

const OPEN = new Set(["PENDING_REVIEW", "OPEN", "HAS_OFFERS"]);

function filterOf(request: MyRequest): Exclude<Filter, "all"> {
  if (request.isDraft || OPEN.has(request.status)) return "open";
  if (request.status === "FULFILLED") return "chosen";
  return "closed";
}

// Đặt lịch F for someone who has posted before (Core MVP pass, 02/10/2026):
// their requests come first, filtered by state, each row saying what is
// new. The status carries a symbol as well as a word, never colour alone.
export function MyRequests({
  requests,
  postButton,
  example,
}: {
  requests: MyRequest[];
  /** The page's one "Đăng yêu cầu". */
  postButton: React.ReactNode;
  /** "Xem ví dụ call sheet", opening its dialog. */
  example: React.ReactNode;
}) {
  const t = useTranslations("publicPages.requestsF.mine");
  const statusT = useTranslations("dashboardCore.serviceRequests.status");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = {
    all: requests.length,
    open: requests.filter((r) => filterOf(r) === "open").length,
    chosen: requests.filter((r) => filterOf(r) === "chosen").length,
    closed: requests.filter((r) => filterOf(r) === "closed").length,
  };
  const visible =
    filter === "all"
      ? requests
      : requests.filter((r) => filterOf(r) === filter);

  const symbol = (request: MyRequest) =>
    request.isDraft
      ? "✎"
      : filterOf(request) === "open"
        ? "●"
        : filterOf(request) === "chosen"
          ? "✓"
          : "○";

  return (
    <section
      aria-labelledby="my-requests"
      className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 pt-[clamp(28px,4vw,56px)] pb-10 sm:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="my-requests" className="text-display-sm text-text-primary">
          {t("title")}
        </h1>
        {postButton}
      </div>

      <div
        role="group"
        aria-label={t("filterLabel")}
        className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {(["all", "open", "chosen", "closed"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "focus-ring min-h-11 shrink-0 rounded-full border px-4 text-body-sm font-semibold whitespace-nowrap",
              filter === key
                ? "border-brand-primary bg-brand-primary text-text-on-brand"
                : "border-border-default bg-bg-surface text-text-primary hover:border-border-strong",
            )}
          >
            {t(`filters.${key}`)} · {counts[key]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-[var(--fg-radius-md)] border border-dashed border-border-default p-5">
          <strong className="text-body-lg text-text-primary">
            {t("filterEmpty", { filter: t(`filters.${filter}`) })}
          </strong>
          <span className="text-body-sm text-text-secondary">
            {t("filterEmptyBody", { total: requests.length })}
          </span>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="focus-ring min-h-11 rounded-[var(--fg-radius-sm)] text-body-sm font-semibold text-text-link"
          >
            {t("showAll")}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface">
          {visible.map((request) => (
            <li key={request.id}>
              <Link
                href={
                  request.isDraft
                    ? `/requests/new?draft=${request.id}`
                    : `/dashboard/requests/${request.id}`
                }
                className="focus-ring flex min-h-[112px] items-center gap-4 px-5 py-4 hover:bg-bg-sunken"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <strong className="text-body-lg font-semibold text-text-primary">
                      {request.title}
                    </strong>
                    <span className="text-body-sm text-text-secondary">
                      <span aria-hidden>{symbol(request)} </span>
                      {request.isDraft ? t("draft") : statusT(request.status)}
                    </span>
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {[request.code, request.when, request.province]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {request.pendingOffers > 0 ? (
                    <span className="text-body-sm font-semibold text-text-link">
                      {t("newOffers", { count: request.pendingOffers })} →
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-text-tertiary"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div>{example}</div>
    </section>
  );
}
