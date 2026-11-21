import type { ModerationStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FgImage } from "@/components/ui/fg-image";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listPlacesForAdmin } from "@/services/places";

export async function generateMetadata() {
  const t = await getTranslations("places.admin");
  return { title: t("metaTitle") };
}

const TABS: ModerationStatus[] = ["PENDING", "APPROVED", "REJECTED"];

/** Photo spots: the review queue, and every spot already on the map. */
export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = TABS.find((tab) => tab === params.status) ?? "PENDING";
  const q = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const [result, t, placesT] = await Promise.all([
    listPlacesForAdmin({ status, q, page }),
    getTranslations("places.admin"),
    getTranslations("places"),
  ]);
  const query = (next: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    const merged = { status, q, ...next };
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
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={query({ status: tab, page: undefined })}
            aria-current={tab === status ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-2 text-body-sm font-semibold",
              tab === status
                ? "border-transparent bg-brand-primary text-text-on-brand"
                : "border-border-default text-text-secondary hover:bg-bg-sunken",
            )}
          >
            {t(`tabs.${tab}`)}
          </Link>
        ))}
      </nav>

      <form action="/admin/places" className="flex max-w-md items-end gap-2">
        <input type="hidden" name="status" value={status} />
        <Input
          name="q"
          label={t("search")}
          defaultValue={q ?? ""}
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          {t("searchButton")}
        </Button>
      </form>

      {result.places.length === 0 ? (
        <Card className="py-8 text-center text-body-sm text-text-secondary">
          {t("empty")}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.places.map((place) => (
            <li key={place.id}>
              <Link
                href={`/admin/places/${place.id}`}
                className="focus-ring flex gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-3 hover:border-border-strong"
              >
                <div className="w-24 shrink-0">
                  <FgImage
                    src={place.thumbnailUrl}
                    alt=""
                    ratio="4/3"
                    rounded="sm"
                    sizes="96px"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-md font-semibold [overflow-wrap:anywhere] text-text-primary">
                    {place.name}
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {placesT(`kinds.${place.kind}`)} · {place.provinceName}
                    {place.operatingStatus !== "OPEN"
                      ? ` · ${placesT(`status.${place.operatingStatus}`)}`
                      : ""}
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
                    {place.pendingPhotos > 0
                      ? ` · ${t("pendingPhotos", { count: place.pendingPhotos })}`
                      : ""}
                  </span>
                </div>
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
