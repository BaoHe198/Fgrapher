import type { PlaceKind } from "@prisma/client";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlaceCard } from "@/components/places/place-card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { PLACE_KINDS } from "@/lib/places";
import { jsonLdScriptProps } from "@/lib/utils";
import { listPublicPlaces, placeProvinces } from "@/services/places";

interface PageProps {
  searchParams: Promise<{ loai?: string }>;
}

function kindFrom(value: string | undefined): PlaceKind | undefined {
  return PLACE_KINDS.find((kind) => kind.toLowerCase() === value);
}

// Dynamic like every public page (the locale is a cookie — see the comment
// at the top of [roleSlug]/[provinceSlug]/page.tsx). Nothing is indexed
// before the first spot is approved: with none public this is a 404, and
// app/sitemap.ts lists it under the same condition.
export async function generateMetadata(): Promise<Metadata> {
  const provinces = await placeProvinces();
  const count = provinces.reduce((sum, p) => sum + p.count, 0);
  if (count === 0) return {};
  const t = await getTranslations("places.index");
  const title = t("metaTitle");
  const description = t("metaDescription", {
    count,
    provinces: provinces.length,
  });
  return {
    title,
    description,
    alternates: { canonical: "/dia-diem" },
    openGraph: { title, description, type: "website" },
  };
}

export default async function PlacesIndexPage({ searchParams }: PageProps) {
  const { loai } = await searchParams;
  const kind = kindFrom(loai);
  const [provinces, places, t, kindT] = await Promise.all([
    placeProvinces(),
    listPublicPlaces({ kind, limit: 24 }),
    getTranslations("places.index"),
    getTranslations("places.kinds"),
  ]);
  if (provinces.length === 0) notFound();
  const total = provinces.reduce((sum, p) => sum + p.count, 0);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-8 sm:py-12">
      <script
        {...jsonLdScriptProps({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: t("title"),
          url: `${baseUrl}/dia-diem`,
          mainEntity: {
            "@type": "ItemList",
            itemListElement: places.data.map((place, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${baseUrl}${place.href}`,
              name: place.name,
            })),
          },
        })}
      />
      <header className="flex flex-col gap-3">
        <h1 className="text-heading-xl text-text-primary">{t("title")}</h1>
        <p className="max-w-2xl text-body-lg text-text-secondary">
          {t("lede")}
        </p>
        <p className="text-body-sm text-text-tertiary">
          {t("count", { count: total })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link href="/fmap?layer=places" />}
          >
            {t("seeMap")}
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/dashboard/places/new" />}
          >
            {t("propose")}
          </Button>
        </div>
      </header>

      <section aria-labelledby="by-province" className="flex flex-col gap-3">
        <h2 id="by-province" className="text-heading-md text-text-primary">
          {t("byProvince")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {provinces.map((province) => (
            <li key={province.code}>
              <Tag render={<Link href={`/dia-diem/${province.code}`} />}>
                {province.name}{" "}
                <span className="text-text-tertiary tabular-nums">
                  {province.count}
                </span>
              </Tag>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="latest" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <h2 id="latest" className="text-heading-md text-text-primary">
            {t("latest")}
          </h2>
          <nav aria-label={t("filterKind")} className="flex flex-wrap gap-2">
            <Tag
              selected={!kind}
              aria-current={!kind ? "page" : undefined}
              render={<Link href="/dia-diem" scroll={false} />}
            >
              {t("allKinds")}
            </Tag>
            {PLACE_KINDS.map((value) => (
              <Tag
                key={value}
                selected={kind === value}
                aria-current={kind === value ? "page" : undefined}
                render={
                  <Link
                    href={`/dia-diem?loai=${value.toLowerCase()}`}
                    scroll={false}
                  />
                }
              >
                {kindT(value)}
              </Tag>
            ))}
          </nav>
        </div>
        {places.data.length === 0 ? (
          <p className="text-body-md text-text-secondary">{t("emptyKind")}</p>
        ) : (
          <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {places.data.map((place, index) => (
              <li key={place.id} className="min-w-0">
                <PlaceCard place={place} priority={index < 3} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
