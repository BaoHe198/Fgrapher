import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Map as MapIcon,
  MapPin,
} from "lucide-react";

import { monthsLabel } from "@/components/places/months-label";
import { PlaceCard } from "@/components/places/place-card";
import { PlaceGallery } from "@/components/places/place-gallery";
import { PlaceReportButton } from "@/components/places/place-report-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { formatDate, formatVND } from "@/lib/format";
import { NEARBY_PROVIDER_RADIUS_KM } from "@/lib/places";
import { jsonLdScriptProps } from "@/lib/utils";
import { getPublicPlace, listPublicPlaces } from "@/services/places";

interface PageProps {
  params: Promise<{ province: string; slug: string }>;
}

const loadPlace = cache(getPublicPlace);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { province, slug } = await params;
  const found = await loadPlace(province, slug);
  if (!found || found.kind === "redirect") return {};
  const { place, photos } = found;
  const t = await getTranslations("places.detail");
  const title = t("metaTitle", {
    name: place.name,
    province: place.provinceName,
  });
  const description = place.description.replace(/\s+/g, " ").slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: place.href },
    openGraph: {
      title,
      description,
      type: "website",
      images: photos[0] ? [{ url: photos[0].url }] : [],
    },
  };
}

// One photo spot: its photos, the facts a customer needs before planning a
// shoot there, and the people who have shot there (project owner,
// 20/11/2026 — guide and booking weigh the same).
export default async function PlacePage({ params }: PageProps) {
  const { province, slug } = await params;
  const found = await loadPlace(province, slug);
  if (!found) notFound();
  // A duplicate an admin merged away keeps working as an address.
  if (found.kind === "redirect") permanentRedirect(found.href);
  const { place, photos, albums, nearbyProviders } = found;

  const [t, placesT, indexT, categoryT, roleT, others] = await Promise.all([
    getTranslations("places.detail"),
    getTranslations("places"),
    getTranslations("places.index"),
    getTranslations("profileCategory"),
    getTranslations("role"),
    listPublicPlaces({ provinceCode: place.provinceCode, limit: 4 }),
  ]);
  const otherPlaces = others.data.filter((p) => p.id !== place.id).slice(0, 3);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const area = [place.wardName, place.provinceName].filter(Boolean).join(", ");
  const months = monthsLabel(place.bestMonths, placesT);
  const unknown = <span className="text-text-tertiary">{t("unknown")}</span>;
  const fee =
    place.entryFeeVnd == null
      ? unknown
      : place.entryFeeVnd === 0
        ? t("free")
        : t("perPerson", { price: formatVND(place.entryFeeVnd) });
  const permit =
    place.permitRequired == null
      ? unknown
      : place.permitRequired
        ? t("permitYes")
        : t("permitNo");
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("bestTime"), value: place.bestTimeNote ?? unknown },
    { label: t("bestMonths"), value: months || unknown },
    { label: t("entryFee"), value: fee },
    { label: t("feeNote"), value: place.feeNote ?? unknown },
    { label: t("permit"), value: permit },
    { label: t("rules"), value: place.rulesNote ?? unknown },
    { label: t("crowd"), value: place.crowdNote ?? unknown },
    { label: t("parking"), value: place.parkingNote ?? unknown },
  ];
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;

  return (
    <article className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
      <script
        {...jsonLdScriptProps([
          {
            "@context": "https://schema.org",
            "@type": "TouristAttraction",
            name: place.name,
            description: place.description,
            url: `${baseUrl}${place.href}`,
            image: photos.slice(0, 5).map((photo) => photo.url),
            geo: {
              "@type": "GeoCoordinates",
              latitude: place.latitude,
              longitude: place.longitude,
            },
            address: {
              "@type": "PostalAddress",
              ...(place.address ? { streetAddress: place.address } : {}),
              ...(place.wardName ? { addressLocality: place.wardName } : {}),
              addressRegion: place.provinceName,
              addressCountry: "VN",
            },
            ...(place.entryFeeVnd != null
              ? { isAccessibleForFree: place.entryFeeVnd === 0 }
              : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: indexT("breadcrumb"),
                item: `${baseUrl}/dia-diem`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: place.provinceName,
                item: `${baseUrl}/dia-diem/${place.provinceCode}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: place.name,
                item: `${baseUrl}${place.href}`,
              },
            ],
          },
        ])}
      />

      <nav aria-label="Breadcrumb" className="text-body-sm text-text-secondary">
        <Link href="/dia-diem" className="hover:underline">
          {indexT("breadcrumb")}
        </Link>
        <span aria-hidden className="px-1.5 text-text-tertiary">
          /
        </span>
        <Link
          href={`/dia-diem/${place.provinceCode}`}
          className="hover:underline"
        >
          {place.provinceName}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-heading-xl text-balance [overflow-wrap:anywhere] text-text-primary">
          {place.name}
        </h1>
        <p className="flex flex-wrap items-center gap-x-1.5 text-body-md text-text-secondary">
          <span>{placesT(`kinds.${place.kind}`)}</span>
          <span aria-hidden>·</span>
          <MapPin aria-hidden className="size-4" />
          <span>{area}</span>
        </p>
      </header>

      {place.operatingStatus !== "OPEN" ? (
        <div
          role="note"
          className="flex gap-3 rounded-[var(--fg-radius-md)] border border-warning/40 bg-warning-bg p-4 text-warning"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {t(`closedTitle.${place.operatingStatus}`)}
            </p>
            <p className="text-body-sm">
              {place.statusNote ?? t("closedBody")}
            </p>
          </div>
        </div>
      ) : null}

      <PlaceGallery placeName={place.name} photos={photos} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          <p className="text-body-lg whitespace-pre-line text-text-primary">
            {place.description}
          </p>

          {place.categories.length > 0 ? (
            <section aria-labelledby="suits" className="flex flex-col gap-2">
              <h2 id="suits" className="text-heading-sm text-text-primary">
                {t("suits")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {place.categories.map((category) => (
                  <li
                    key={category}
                    className="rounded-full border border-border-default px-3 py-1 text-body-sm text-text-secondary"
                  >
                    {categoryT(category)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="facts" className="flex flex-col gap-3">
            <h2 id="facts" className="text-heading-md text-text-primary">
              {t("facts")}
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              {facts.map((fact) => (
                <div key={fact.label} className="contents">
                  <dt className="text-body-sm font-semibold text-text-secondary">
                    {fact.label}
                  </dt>
                  <dd className="text-body-md text-text-primary max-sm:-mt-2 max-sm:mb-1">
                    {fact.value}
                  </dd>
                </div>
              ))}
              <div className="contents">
                <dt className="text-body-sm font-semibold text-text-secondary">
                  {t("address")}
                </dt>
                <dd className="flex flex-col gap-2 text-body-md text-text-primary max-sm:-mt-2">
                  <span>
                    {[place.address, area].filter(Boolean).join(", ")}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      nativeButton={false}
                      render={
                        <a
                          href={directions}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <ExternalLink aria-hidden />
                      {t("directions")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`/fmap?layer=places&lat=${place.latitude}&lng=${place.longitude}&place=${place.id}`}
                        />
                      }
                    >
                      <MapIcon aria-hidden />
                      {t("onMap")}
                    </Button>
                  </span>
                </dd>
              </div>
            </dl>
            <p className="text-body-sm text-text-tertiary">
              {place.lastVerifiedAt
                ? t("verifiedAt", { date: formatDate(place.lastVerifiedAt) })
                : t("updatedAt", { date: formatDate(place.updatedAt) })}{" "}
              {t("factsNote")}
            </p>
            <div>
              <PlaceReportButton placeId={place.id} href={place.href} />
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="shot-here" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="shot-here" className="text-heading-md text-text-primary">
                {t("shotHere")}
              </h2>
              {albums.total > 0 ? (
                <span className="text-body-sm text-text-tertiary tabular-nums">
                  {t("shotHereCount", { count: albums.total })}
                </span>
              ) : null}
            </div>
            {albums.data.length === 0 ? (
              <div className="flex flex-col gap-1 rounded-[var(--fg-radius-md)] border border-dashed border-border-strong p-4">
                <p className="text-body-md text-text-primary">
                  {t("shotHereEmpty")}
                </p>
                <p className="text-body-sm text-text-secondary">
                  {t("shotHereHint")}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {albums.data.map((album) => (
                  <li key={album.id} className="flex gap-3">
                    <Link
                      href={album.href}
                      className="focus-ring w-28 shrink-0 rounded-[var(--fg-radius-sm)]"
                      aria-label={album.title}
                    >
                      <FgImage
                        src={album.coverUrl}
                        alt=""
                        ratio="4/3"
                        rounded="sm"
                        sizes="112px"
                      />
                    </Link>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={album.href}
                        className="truncate text-body-md font-semibold text-text-primary hover:underline"
                      >
                        {album.title}
                      </Link>
                      <Link
                        href={`/profile/${album.providerUsername}`}
                        className="truncate text-body-sm text-text-secondary hover:underline"
                      >
                        {t("albumBy", { name: album.providerName })}
                        {" · "}
                        {roleT(album.providerRole)}
                      </Link>
                      <span className="text-meta text-text-tertiary">
                        {t("photoCount", { count: album.photoCount })}
                        {" · "}
                        {album.startingPrice != null
                          ? t("from", { price: formatVND(album.startingPrice) })
                          : t("contactPrice")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {nearbyProviders.length > 0 ? (
            <section aria-labelledby="nearby" className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="nearby" className="text-heading-md text-text-primary">
                  {t("nearby")}
                </h2>
                <p className="text-body-sm text-text-tertiary">
                  {t("nearbyHint", { km: NEARBY_PROVIDER_RADIUS_KM })}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {nearbyProviders.map((provider) => (
                  <li key={provider.profileId}>
                    <Link
                      href={`/profile/${provider.username}`}
                      className="focus-ring flex items-center gap-3 rounded-[var(--fg-radius-md)] p-2 hover:bg-bg-sunken"
                    >
                      <Avatar className="size-10">
                        {provider.avatar ? (
                          <AvatarImage src={provider.avatar} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {provider.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-body-md font-semibold text-text-primary">
                          {provider.name}
                        </span>
                        <span className="text-body-sm text-text-secondary">
                          {roleT(provider.role)}
                          {" · "}
                          {provider.startingPrice != null
                            ? t("from", {
                                price: formatVND(provider.startingPrice),
                              })
                            : t("contactPrice")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {otherPlaces.length > 0 ? (
        <section aria-labelledby="more-places" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="more-places" className="text-heading-md text-text-primary">
              {t("moreInProvince", { province: place.provinceName })}
            </h2>
            <Link
              href={`/dia-diem/${place.provinceCode}`}
              className="text-body-sm font-semibold text-text-link hover:underline"
            >
              {t("seeAllInProvince", { province: place.provinceName })}
            </Link>
          </div>
          <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {otherPlaces.map((other) => (
              <li key={other.id} className="min-w-0">
                <PlaceCard place={other} showProvince={false} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
