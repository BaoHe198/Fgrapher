import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Flag,
  Map as MapIcon,
  Pencil,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { monthsLabel } from "@/components/places/months-label";
import { placeToFormValues } from "@/components/places/form-values";
import { PlaceForm } from "@/components/places/place-form";
import { PlaceMiniMapLazy } from "@/components/places/place-mini-map-lazy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { DUPLICATE_RADIUS_M } from "@/lib/places";
import { listProvinces } from "@/services/geography";
import { getPlaceForAdmin } from "@/services/places";

import {
  PlaceDeleteButton,
  PlaceMergeButton,
  PlacePhotosPanel,
  PlaceReviewPanel,
  PlaceStatusPanel,
} from "./place-admin-actions";

export async function generateMetadata() {
  const t = await getTranslations("places.admin");
  return { title: t("metaTitle") };
}

/**
 * One spot for an admin, in the order a review goes (owner, 21/11/2026:
 * "dễ quản lý, dễ sử dụng"): the decision first; what customers reported;
 * where it is and what it claims, read-only, with the map up top (the pin
 * used to sit 1,700px down, inside the edit form); the photos; and the edit
 * form folded away until it is wanted.
 */
export default async function AdminPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await getPlaceForAdmin(id);
  if (!found) notFound();
  const { place, nearby, reports, href } = found;
  const [provinces, t, placesT, detailT, categoryT, reasonT] =
    await Promise.all([
      listProvinces(),
      getTranslations("places.admin"),
      getTranslations("places"),
      getTranslations("places.detail"),
      getTranslations("profileCategory"),
      getTranslations("sharedComponents.reportModal.reasons"),
    ]);
  const dash = <span className="text-text-tertiary">—</span>;
  const facts: [string, React.ReactNode][] = [
    [detailT("bestTime"), place.bestTimeNote ?? dash],
    [detailT("bestMonths"), monthsLabel(place.bestMonths, placesT) || dash],
    [
      detailT("entryFee"),
      place.entryFeeVnd == null
        ? dash
        : place.entryFeeVnd === 0
          ? detailT("free")
          : detailT("perPerson", { price: formatVND(place.entryFeeVnd) }),
    ],
    [detailT("feeNote"), place.feeNote ?? dash],
    [
      detailT("permit"),
      place.permitRequired == null
        ? dash
        : place.permitRequired
          ? detailT("permitYes")
          : detailT("permitNo"),
    ],
    [detailT("rules"), place.rulesNote ?? dash],
    [detailT("crowd"), place.crowdNote ?? dash],
    [detailT("parking"), place.parkingNote ?? dash],
  ];
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  const proposer = place.submittedBy
    ? (place.submittedBy.name ??
      place.submittedBy.username ??
      place.submittedBy.email)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/places"
        className="flex w-fit items-center gap-1.5 text-body-sm text-text-secondary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t("backToList")}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-display-md [overflow-wrap:anywhere] text-text-primary">
            {place.name}
          </h1>
          <Badge
            variant={
              place.reviewStatus === "APPROVED"
                ? "success"
                : place.reviewStatus === "PENDING"
                  ? "neutral"
                  : "destructive"
            }
          >
            {placesT(`review.${place.reviewStatus}`)}
          </Badge>
          {place.operatingStatus !== "OPEN" ? (
            <Badge variant="warning">
              {placesT(`status.${place.operatingStatus}`)}
            </Badge>
          ) : null}
        </div>
        <p className="text-body-sm text-text-secondary">
          {placesT(`kinds.${place.kind}`)} · {place.province.name}
          {place.ward ? `, ${place.ward.name}` : ""} ·{" "}
          {proposer
            ? t("submittedBy", { name: proposer })
            : t("submittedByUnknown")}{" "}
          · {formatDateTime(place.createdAt)} ·{" "}
          {t("albums", { count: place._count.albums })}
        </p>
        {place.reviewStatus === "REJECTED" && place.moderationNote ? (
          <p className="text-body-sm text-danger">
            {t("rejectedBecause", { note: place.moderationNote })}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {place.reviewStatus === "PENDING" ? (
            <Card className="flex flex-col gap-3 border-brand-primary/40">
              <h2 className="text-heading-md text-text-primary">
                {t("reviewTitle")}
              </h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-text-secondary">
                <li>{t("checklist.place")}</li>
                <li>{t("checklist.duplicate")}</li>
                <li>{t("checklist.photos")}</li>
              </ul>
              <PlaceReviewPanel placeId={place.id} />
            </Card>
          ) : null}

          {reports.length > 0 ? (
            <Card className="flex flex-col gap-3 border-danger/40">
              <h2 className="flex items-center gap-2 text-heading-md text-text-primary">
                <Flag aria-hidden className="size-5 text-danger" />
                {t("reportsTitle", { count: reports.length })}
              </h2>
              <ul className="flex flex-col gap-2">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-col gap-0.5 rounded-[var(--fg-radius-sm)] bg-bg-sunken p-3"
                  >
                    <span className="text-body-sm font-semibold text-text-primary">
                      {reasonT.has(report.reason)
                        ? reasonT(report.reason)
                        : report.reason}
                      <span className="font-normal text-text-tertiary">
                        {" · "}
                        {formatDateTime(report.createdAt)}
                      </span>
                    </span>
                    {report.description ? (
                      <span className="text-body-sm text-text-secondary">
                        {report.description}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/reports"
                className="w-fit text-body-sm font-semibold text-text-link hover:underline"
              >
                {t("reportsOpen")}
              </Link>
            </Card>
          ) : null}

          <Card className="flex flex-col gap-4">
            <h2 className="text-heading-md text-text-primary">
              {t("summaryTitle")}
            </h2>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                <PlaceMiniMapLazy
                  latitude={place.latitude}
                  longitude={place.longitude}
                  label={detailT("mapAlt", { name: place.name })}
                />
                <p className="text-body-sm text-text-secondary">
                  {[place.address, place.ward?.name, place.province.name]
                    .filter(Boolean)
                    .join(", ")}
                  <span className="ml-1.5 font-mono text-meta text-text-tertiary tabular-nums">
                    {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a
                        href={googleMaps}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <ExternalLink aria-hidden />
                    {t("openGoogleMaps")}
                  </Button>
                  {place.reviewStatus === "APPROVED" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={href} target="_blank" />}
                    >
                      <MapIcon aria-hidden />
                      {t("viewPublic")}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <p className="text-body-md whitespace-pre-line text-text-primary">
                  {place.description}
                </p>
                {place.categories.length > 0 ? (
                  <p className="text-body-sm text-text-secondary">
                    {detailT("suits")}:{" "}
                    {place.categories.map((c) => categoryT(c)).join(", ")}
                  </p>
                ) : null}
                <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body-sm">
                  {facts.map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-text-tertiary">{label}</dt>
                      <dd className="text-text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-heading-md text-text-primary">
              {t("photosTitle")}
            </h2>
            <PlacePhotosPanel
              placeId={place.id}
              coverMediaId={place.coverMediaId}
              photos={place.media.map((m) => ({
                id: m.id,
                url: m.url,
                moderationStatus: m.moderationStatus,
              }))}
            />
          </Card>

          {/* The full form is long: folded until the admin asks for it. */}
          <Card className="flex flex-col gap-3">
            <details className="group">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--fg-radius-sm)] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-heading-md text-text-primary">
                  <Pencil aria-hidden className="size-5" />
                  {t("editTitle")}
                </span>
                <span className="text-body-sm font-semibold text-text-link group-open:hidden">
                  {t("editOpen")}
                </span>
              </summary>
              <div className="mt-4">
                <PlaceForm
                  mode="adminEdit"
                  placeId={place.id}
                  initial={placeToFormValues(place)}
                  provinces={provinces}
                  doneHref={`/admin/places/${place.id}`}
                />
              </div>
            </details>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3">
            <h2 className="text-heading-md text-text-primary">
              {t("statusTitle")}
            </h2>
            <p className="text-body-sm text-text-secondary">
              {place.lastVerifiedAt
                ? t("lastVerified", { date: formatDate(place.lastVerifiedAt) })
                : t("neverVerified")}
            </p>
            <PlaceStatusPanel
              placeId={place.id}
              operatingStatus={place.operatingStatus}
              statusNote={place.statusNote}
            />
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-heading-md text-text-primary">
              {nearby.length > 0 ? (
                <AlertTriangle aria-hidden className="size-5 text-warning" />
              ) : null}
              {t("duplicatesTitle")}
            </h2>
            {nearby.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                {t("noDuplicates", { meters: DUPLICATE_RADIUS_M })}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {nearby.map((other) => (
                  <li key={other.id} className="flex flex-col gap-1.5">
                    <Link
                      href={`/admin/places/${other.id}`}
                      className="text-body-md font-semibold [overflow-wrap:anywhere] text-text-link hover:underline"
                    >
                      {other.name}
                    </Link>
                    <span className="text-body-sm text-text-secondary">
                      {placesT(`review.${other.reviewStatus}`)} ·{" "}
                      {other.distanceM} m
                    </span>
                    <PlaceMergeButton
                      placeId={place.id}
                      placeName={place.name}
                      into={{ id: other.id, name: other.name }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <PlaceDeleteButton placeId={place.id} placeName={place.name} />
        </div>
      </div>
    </div>
  );
}
