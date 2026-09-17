"use client";

import type { Role } from "@prisma/client";
import {
  CalendarDays,
  Handshake,
  Loader2,
  MapPin,
  WalletCards,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { PROVIDER_ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn, formatBudgetRange } from "@/lib/utils";

interface BrowsableRequest {
  id: string;
  code: string;
  title: string;
  role: Role;
  province: { name: string };
  ward: { name: string } | null;
  budgetMin: number | null;
  budgetMax: number | null;
  isDateFlexible: boolean;
  shootDate: string | null;
  createdAt: string;
  customerDisplayName: string;
  isOwner: boolean;
  _count: { offers: number };
}

interface WardOption {
  id: string;
  name: string;
}

export function BrowseRequestsClient({
  heading,
  subheading,
  provinces,
}: {
  heading: string;
  subheading: string;
  provinces: { id: string; code: string; name: string }[];
}) {
  const t = useTranslations("dashboardCore.browseRequests");
  const roleT = useTranslations("role");

  const [role, setRole] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [wardId, setWardId] = useState("");
  const [wards, setWards] = useState<WardOption[]>([]);
  const [requests, setRequests] = useState<BrowsableRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ward coverage is HCMC-only today (see prisma/data/hcmc-wards.ts) — most
  // provinces resolve to an empty list here, so the select below just falls
  // back to "all wards" rather than hiding.
  useEffect(() => {
    const province = provinces.find((p) => p.id === provinceId);
    if (!province) {
      startTransition(() => setWards([]));
      return;
    }
    fetch(
      `/api/geography/wards?provinceCode=${encodeURIComponent(province.code)}`,
    )
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])))
      .catch(() => startTransition(() => setWards([])));
  }, [provinceId, provinces]);

  useEffect(() => {
    const controller = new AbortController();
    startTransition(() => setIsLoading(true));
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (provinceId) params.set("provinceId", provinceId);
    if (wardId) params.set("wardId", wardId);

    fetch(`/api/requests/browse?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((body) => {
        setRequests(Array.isArray(body.data) ? body.data : []);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setIsLoading(false);
      });

    // Changing several filters quickly used to leave older requests in
    // flight. A slower empty response could arrive after a newer non-empty
    // response and replace the list with the empty state.
    return () => controller.abort();
  }, [role, provinceId, wardId]);

  const filters = (
    <div className="flex flex-col gap-4">
      <NativeSelect
        label={t("roleFilterLabel")}
        value={role}
        onChange={setRole}
        options={[
          { value: "", label: t("allRoles") },
          ...PROVIDER_ROLES.map((r) => ({ value: r, label: roleT(r) })),
        ]}
      />
      <NativeSelect
        label={t("provinceFilterLabel")}
        value={provinceId}
        onChange={(value) => {
          setProvinceId(value);
          setWardId("");
        }}
        options={[
          { value: "", label: t("allProvinces") },
          ...provinces.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
      <NativeSelect
        label={t("wardFilterLabel")}
        value={wardId}
        onChange={setWardId}
        disabled={!provinceId || wards.length === 0}
        options={[
          { value: "", label: t("allWards") },
          ...wards.map((w) => ({ value: w.id, label: w.name })),
        ]}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 pb-[72px] sm:px-8">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[268px_1fr]">
        <div className="lg:sticky lg:top-[104px]">
          <Card className="flex flex-col gap-1">
            <p className="mb-1 text-body-sm font-semibold! text-text-tertiary">
              {t("filtersHeading")}
            </p>
            {filters}
          </Card>
        </div>

        <div className="min-w-0">
          <div className="mb-5 flex flex-col gap-1">
            <h1 className="text-display-md text-text-primary">{heading}</h1>
            <p className="text-body-md text-text-secondary">{subheading}</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-text-tertiary" />
            </div>
          ) : requests.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-16 text-center">
              <Handshake className="size-10 text-text-tertiary" />
              <p className="text-body-md font-semibold! text-text-primary">
                {t("empty.title")}
              </p>
              <p className="text-body-sm text-text-secondary">
                {t("empty.body")}
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((request) => (
                <Link
                  key={request.id}
                  href={
                    request.isOwner
                      ? `/dashboard/requests/${request.id}`
                      : `/dashboard/opportunities/${request.id}?role=${request.role}`
                  }
                >
                  <Card
                    interactive
                    className={cn(
                      "flex flex-col gap-3",
                      request.isOwner &&
                        "border-brand-primary/40 bg-success-bg/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-body-md font-semibold! text-text-primary">
                          {request.title}
                        </p>
                        <p className="text-body-sm text-text-tertiary">
                          {request.code} · {roleT(request.role)} ·{" "}
                          {t("postedBy", {
                            name:
                              request.customerDisplayName ||
                              t("unknownRequester"),
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {request.isOwner ? (
                          <Badge variant="success">{t("yourRequest")}</Badge>
                        ) : null}
                        <span className="rounded-full bg-bg-sunken px-2.5 py-1 text-body-sm font-semibold! text-text-secondary">
                          {t("offerCount", { count: request._count.offers })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-body-sm font-semibold!">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1.5 text-gold-800">
                        <WalletCards className="size-4" />
                        {formatBudgetRange(
                          request.budgetMin,
                          request.budgetMax,
                        ) ?? t("budgetNotSet")}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-3 py-1.5 text-info">
                        <MapPin className="size-4" />
                        {request.ward ? `${request.ward.name}, ` : ""}
                        {request.province.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-sunken px-3 py-1.5 text-text-secondary">
                        <CalendarDays className="size-4" />
                        {request.isDateFlexible
                          ? t("flexible")
                          : request.shootDate
                            ? formatDate(request.shootDate)
                            : "—"}
                      </span>
                      <span className="ml-auto text-text-tertiary">
                        {formatDate(request.createdAt)}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
