import { ArrowLeft, ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { placeToFormValues } from "@/components/places/form-values";
import { PlaceForm } from "@/components/places/place-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
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

/** One spot for an admin: review, photos, status, facts, duplicates. */
export default async function AdminPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await getPlaceForAdmin(id);
  if (!found) notFound();
  const { place, nearby, href } = found;
  const [provinces, t, placesT] = await Promise.all([
    listProvinces(),
    getTranslations("places.admin"),
    getTranslations("places"),
  ]);

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
        </div>
        <p className="text-body-sm text-text-secondary">
          {placesT(`kinds.${place.kind}`)} · {place.province.name}
          {place.ward ? `, ${place.ward.name}` : ""} ·{" "}
          {place.submittedBy
            ? t("submittedBy", {
                name:
                  place.submittedBy.name ??
                  place.submittedBy.username ??
                  place.submittedBy.email,
              })
            : t("submittedByUnknown")}{" "}
          · {formatDateTime(place.createdAt)} ·{" "}
          {t("albums", { count: place._count.albums })}
        </p>
        {place.reviewStatus === "REJECTED" && place.moderationNote ? (
          <p className="text-body-sm text-danger">{place.moderationNote}</p>
        ) : null}
        {place.reviewStatus === "APPROVED" ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            nativeButton={false}
            render={<Link href={href} target="_blank" />}
          >
            <ExternalLink aria-hidden />
            {t("viewPublic")}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {place.reviewStatus === "PENDING" ? (
            <Card className="flex flex-col gap-3">
              <h2 className="text-heading-md text-text-primary">
                {t("reviewTitle")}
              </h2>
              <PlaceReviewPanel placeId={place.id} />
            </Card>
          ) : null}

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

          <Card className="flex flex-col gap-3">
            <h2 className="text-heading-md text-text-primary">
              {t("factsTitle")}
            </h2>
            <PlaceForm
              mode="adminEdit"
              placeId={place.id}
              initial={placeToFormValues(place)}
              provinces={provinces}
              doneHref={`/admin/places/${place.id}`}
            />
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
            <h2 className="text-heading-md text-text-primary">
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
                      className="text-body-md font-semibold text-text-link hover:underline"
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
