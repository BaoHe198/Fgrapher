import type { ProfileCategory } from "@prisma/client";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CATEGORIES_BY_ROLE } from "@/lib/constants";
import { VIETNAM_BOUNDS } from "@/lib/places";
import { FMAP_PROVIDER_ROLES } from "@/lib/validations/fmap";
import { hasPublicPlaces } from "@/services/places";

import { FmapClient } from "./fmap-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fmap");
  return { title: t("title"), description: t("subtitle") };
}

type FmapRole = (typeof FMAP_PROVIDER_ROLES)[number];

// `/fmap?role=STUDIO&category=INDOOR` — how /browse hands its context over
// when the customer switches from the list to the map. Anything unknown
// falls back to the defaults instead of erroring.
export default async function FmapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const role = (FMAP_PROVIDER_ROLES as readonly string[]).includes(
    String(params.role),
  )
    ? (params.role as FmapRole)
    : "PHOTOGRAPHER";
  const category = (CATEGORIES_BY_ROLE[role] ?? []).includes(
    params.category as ProfileCategory,
  )
    ? (params.category as ProfileCategory)
    : "";

  // A spot's "Xem trên Bản đồ F" link: ?layer=places&lat=&lng=&place=.
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const centre =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= VIETNAM_BOUNDS.south &&
    lat <= VIETNAM_BOUNDS.north &&
    lng >= VIETNAM_BOUNDS.west &&
    lng <= VIETNAM_BOUNDS.east
      ? { latitude: lat, longitude: lng }
      : null;

  return (
    <FmapClient
      initialRole={role}
      initialCategory={category}
      placesAvailable={await hasPublicPlaces()}
      initialPlacesOn={params.layer === "places"}
      initialCentre={centre}
      initialPlaceId={typeof params.place === "string" ? params.place : null}
    />
  );
}
