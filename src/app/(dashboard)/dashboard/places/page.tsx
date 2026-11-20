import { CheckCircle2, MapPin, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { auth } from "@/lib/auth";
import { MAX_PENDING_PLACES } from "@/lib/places";
import { canProposePlaces, listMyPlaces } from "@/services/places";

import { WithdrawPlaceButton } from "./withdraw-place-button";

export async function generateMetadata() {
  const t = await getTranslations("places.mine");
  return { title: t("metaTitle") };
}

const REVIEW_BADGE = {
  PENDING: "neutral",
  APPROVED: "success",
  REJECTED: "destructive",
  AUTO_REJECTED: "destructive",
} as const;

/** "Địa điểm chụp" — the spots this provider proposed, and their state. */
export default async function MyPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const [{ approved }, allowed, places, t, placesT] = await Promise.all([
    searchParams,
    canProposePlaces(session.user.id),
    listMyPlaces(session.user.id),
    getTranslations("places.mine"),
    getTranslations("places"),
  ]);
  const pending = places.filter((p) => p.reviewStatus === "PENDING").length;
  const justApproved = places.find(
    (p) => p.id === approved && p.reviewStatus === "APPROVED",
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("lede")}</p>
      </div>

      {justApproved ? (
        <p
          role="status"
          className="flex gap-2 rounded-[var(--fg-radius-md)] bg-success-bg p-3 text-body-sm text-success"
        >
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("approvedNotice")}
        </p>
      ) : null}

      {allowed ? (
        <div className="flex flex-wrap items-center gap-3">
          {pending >= MAX_PENDING_PLACES ? (
            <Button variant="primary" disabled>
              <Plus aria-hidden />
              {t("propose")}
            </Button>
          ) : (
            <Button
              variant="primary"
              nativeButton={false}
              render={<Link href="/dashboard/places/new" />}
            >
              <Plus aria-hidden />
              {t("propose")}
            </Button>
          )}
          {pending >= MAX_PENDING_PLACES ? (
            <span className="text-body-sm text-text-secondary">
              {t("pendingLimit", { count: pending, max: MAX_PENDING_PLACES })}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-[var(--fg-radius-md)] border border-border-default p-4">
          <p className="font-semibold text-text-primary">
            {t("notAllowedTitle")}
          </p>
          <p className="text-body-sm text-text-secondary">
            {t("notAllowedBody")}
          </p>
          <Button
            variant="secondary"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/my-page" />}
          >
            {t("verify")}
          </Button>
        </div>
      )}

      {places.length === 0 ? (
        <p className="text-body-md text-text-secondary">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {places.map((place) => (
            <li
              key={place.id}
              className="flex gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-3"
            >
              <div className="w-24 shrink-0 sm:w-32">
                <FgImage
                  src={place.thumbnailUrl}
                  alt=""
                  ratio="4/3"
                  rounded="sm"
                  sizes="128px"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-md font-semibold text-text-primary">
                    {place.name}
                  </span>
                  <Badge variant={REVIEW_BADGE[place.reviewStatus]}>
                    {placesT(`review.${place.reviewStatus}`)}
                  </Badge>
                </div>
                <span className="flex items-center gap-1 text-body-sm text-text-secondary">
                  <MapPin aria-hidden className="size-3.5" />
                  {placesT(`kinds.${place.kind}`)} · {place.provinceName}
                </span>
                {place.reviewStatus === "REJECTED" && place.moderationNote ? (
                  <span className="text-body-sm text-danger">
                    {t("rejectedNote", { note: place.moderationNote })}
                  </span>
                ) : null}
                {place.reviewStatus === "APPROVED" ? (
                  <span className="text-meta text-text-tertiary">
                    {t("albums", { count: place.albumCount })}
                  </span>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-2">
                  {place.href ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={place.href} />}
                    >
                      {t("view")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/dashboard/places/${place.id}`} />}
                      >
                        {place.reviewStatus === "REJECTED"
                          ? t("edit")
                          : t("editPending")}
                      </Button>
                      <WithdrawPlaceButton id={place.id} name={place.name} />
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
