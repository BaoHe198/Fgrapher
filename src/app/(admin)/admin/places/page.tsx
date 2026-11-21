import type { ModerationStatus } from "@prisma/client";
import { ChevronRight, Flag, Image as ImageIcon, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FgImage } from "@/components/ui/fg-image";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  listPlacesForAdmin,
  placeAdminCounts,
  placeProvinces,
} from "@/services/places";

import { NativeSelectField } from "./native-select-field";

export async function generateMetadata() {
  const t = await getTranslations("places.admin");
  return { title: t("metaTitle") };
}

type Tab = Exclude<ModerationStatus, "AUTO_REJECTED"> | "ATTENTION";
const TABS: Tab[] = ["PENDING", "ATTENTION", "APPROVED", "REJECTED"];

/**
 * Photo spots for an admin (owner, 21/11/2026: easy to manage): the
 * review queue, the public spots that need another look (a customer's
 * report, a closure), everything approved or rejected — each tab with its
 * count, filterable by province, every row saying what is waiting on it.
 */
export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    tinh?: string;
  }>;
}) {
  const params = await searchParams;
  const tab = TABS.find((value) => value === params.status) ?? "PENDING";
  const q = params.q?.trim() || undefined;
  const provinceCode = params.tinh || undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const [result, counts, provinces, t, placesT] = await Promise.all([
    listPlacesForAdmin({
      status: tab === "ATTENTION" ? "APPROVED" : tab,
      attention: tab === "ATTENTION",
      q,
      provinceCode,
      page,
    }),
    placeAdminCounts(),
    placeProvinces(),
    getTranslations("places.admin"),
    getTranslations("places"),
  ]);
  const tabCount: Record<Tab, number> = {
    PENDING: counts.PENDING,
    ATTENTION: counts.attention,
    APPROVED: counts.APPROVED,
    REJECTED: counts.REJECTED,
  };
  const query = (next: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    const merged = { status: tab, q, tinh: provinceCode, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    return `/admin/places?${search}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-display-md text-text-primary">{t("title")}</h1>
          <p className="text-body-md text-text-secondary">{t("lede")}</p>
        </div>
        <Button
          variant="primary"
          nativeButton={false}
          render={<Link href="/admin/places/new" />}
        >
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {TABS.map((value) => (
          <Link
            key={value}
            href={query({ status: value, page: undefined })}
            aria-current={value === tab ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-body-sm font-semibold",
              value === tab
                ? "border-transparent bg-brand-primary text-text-on-brand"
                : "border-border-default text-text-secondary hover:bg-bg-sunken",
            )}
          >
            {t(`tabs.${value}`)}
            <span
              className={cn(
                "min-w-6 rounded-full px-1.5 text-center text-meta tabular-nums",
                value === tab
                  ? "bg-white/20"
                  : tabCount[value] > 0 &&
                      (value === "PENDING" || value === "ATTENTION")
                    ? "bg-danger text-text-on-brand"
                    : "bg-bg-sunken",
              )}
            >
              {tabCount[value]}
            </span>
          </Link>
        ))}
      </nav>
      {tab === "ATTENTION" ? (
        <p className="-mt-2 text-body-sm text-text-secondary">
          {t("attentionHint")}
        </p>
      ) : null}

      <form action="/admin/places" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="status" value={tab} />
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 sm:max-w-sm">
          <span className="text-body-sm font-semibold text-text-primary">
            {t("search")}
          </span>
          <input
            name="q"
            defaultValue={q ?? ""}
            className="h-11 rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3 text-body-md text-text-primary outline-none focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus/30"
          />
        </label>
        <NativeSelectField
          name="tinh"
          label={t("province")}
          defaultValue={provinceCode ?? ""}
          options={[
            { value: "", label: t("allProvinces") },
            ...provinces.map((p) => ({ value: p.code, label: p.name })),
          ]}
        />
        <Button type="submit" variant="secondary">
          {t("searchButton")}
        </Button>
      </form>

      {result.places.length === 0 ? (
        <Card className="py-8 text-center text-body-sm text-text-secondary">
          {tab === "PENDING" ? t("emptyPending") : t("empty")}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.places.map((place) => (
            <li key={place.id}>
              <Link
                href={`/admin/places/${place.id}`}
                className="focus-ring flex items-center gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-3 hover:border-border-strong"
              >
                <div className="w-24 shrink-0 sm:w-28">
                  <FgImage
                    src={place.thumbnailUrl}
                    alt=""
                    ratio="4/3"
                    rounded="sm"
                    sizes="112px"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-body-md font-semibold [overflow-wrap:anywhere] text-text-primary">
                    {place.name}
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {placesT(`kinds.${place.kind}`)} · {place.provinceName}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {place.openReports > 0 ? (
                      <Badge variant="destructive">
                        <Flag aria-hidden />
                        {t("reportsBadge", { count: place.openReports })}
                      </Badge>
                    ) : null}
                    {place.pendingPhotos > 0 ? (
                      <Badge variant="neutral">
                        <ImageIcon aria-hidden />
                        {t("pendingPhotos", { count: place.pendingPhotos })}
                      </Badge>
                    ) : null}
                    {place.operatingStatus !== "OPEN" ? (
                      <Badge variant="warning">
                        {placesT(`status.${place.operatingStatus}`)}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-meta text-text-tertiary">
                    {place.submittedBy
                      ? t("submittedBy", {
                          name:
                            place.submittedBy.name ??
                            place.submittedBy.username ??
                            place.submittedBy.email,
                        })
                      : t("submittedByUnknown")}
                    {" · "}
                    {formatDateTime(place.createdAt)}
                    {tab !== "PENDING"
                      ? ` · ${
                          place.lastVerifiedAt
                            ? t("lastVerified", {
                                date: formatDate(place.lastVerifiedAt),
                              })
                            : t("neverVerified")
                        }`
                      : ""}
                  </span>
                </div>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-text-tertiary"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <div className="flex gap-2">
          {page > 1 ? (
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<Link href={query({ page: page - 1 })} />}
            >
              ←
            </Button>
          ) : null}
          <span className="self-center text-body-sm text-text-secondary tabular-nums">
            {page}/{result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<Link href={query({ page: page + 1 })} />}
            >
              →
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
