import type { PlaceKind } from "@prisma/client";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PlaceCard } from "@/components/places/place-card";
import { Tag } from "@/components/ui/tag";
import { PLACE_KINDS } from "@/lib/places";
import { jsonLdScriptProps } from "@/lib/utils";
import { listPublicPlaces, placeProvinces } from "@/services/places";

interface PageProps {
  params: Promise<{ province: string }>;
  searchParams: Promise<{ loai?: string }>;
}

// Only provinces with at least one public spot exist; anything else is a
// 404 rather than an empty page (and the sitemap uses the same list).
const loadProvinces = cache(placeProvinces);

async function findProvince(code: string) {
  return (await loadProvinces()).find((p) => p.code === code) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { province: code } = await params;
  const province = await findProvince(code);
  if (!province) return {};
  const t = await getTranslations("places.province");
  const values = { province: province.name, count: province.count };
  const title = t("metaTitle", values);
  const description = t("metaDescription", values);
  return {
    title,
    description,
    alternates: { canonical: `/dia-diem/${province.code}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function ProvincePlacesPage({
  params,
  searchParams,
}: PageProps) {
  const [{ province: code }, { loai }] = await Promise.all([
    params,
    searchParams,
  ]);
  const province = await findProvince(code);
  if (!province) notFound();
  const kind: PlaceKind | undefined = PLACE_KINDS.find(
    (value) => value.toLowerCase() === loai,
  );
  const [places, allInProvince, provinces, t, indexT, kindT] =
    await Promise.all([
      listPublicPlaces({ provinceCode: province.code, kind, limit: 60 }),
      kind
        ? listPublicPlaces({ provinceCode: province.code, limit: 60 })
        : null,
      loadProvinces(),
      getTranslations("places.province"),
      getTranslations("places.index"),
      getTranslations("places.kinds"),
    ]);
  // Only the kinds this province actually has get a filter chip.
  const kindsHere = new Set(
    (allInProvince ?? places).data.map((place) => place.kind),
  );
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const values = { province: province.name, count: province.count };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8 sm:py-12">
      <script
        {...jsonLdScriptProps({
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
              name: province.name,
              item: `${baseUrl}/dia-diem/${province.code}`,
            },
          ],
        })}
      />
      <nav aria-label="Breadcrumb" className="text-body-sm text-text-secondary">
        <Link href="/dia-diem" className="hover:underline">
          {indexT("breadcrumb")}
        </Link>
        <span aria-hidden className="px-1.5 text-text-tertiary">
          /
        </span>
        <span aria-current="page">{province.name}</span>
      </nav>
      <header className="flex flex-col gap-3">
        <h1 className="text-heading-xl text-text-primary">
          {t("title", values)}
        </h1>
        <p className="max-w-2xl text-body-lg text-text-secondary">
          {t("lede", values)}
        </p>
      </header>

      {kindsHere.size > 1 ? (
        <nav aria-label={indexT("filterKind")} className="flex flex-wrap gap-2">
          <Tag
            selected={!kind}
            aria-current={!kind ? "page" : undefined}
            render={<Link href={`/dia-diem/${province.code}`} scroll={false} />}
          >
            {indexT("allKinds")}
          </Tag>
          {PLACE_KINDS.filter((value) => kindsHere.has(value)).map((value) => (
            <Tag
              key={value}
              selected={kind === value}
              aria-current={kind === value ? "page" : undefined}
              render={
                <Link
                  href={`/dia-diem/${province.code}?loai=${value.toLowerCase()}`}
                  scroll={false}
                />
              }
            >
              {kindT(value)}
            </Tag>
          ))}
        </nav>
      ) : null}

      {places.data.length === 0 ? (
        <p className="text-body-md text-text-secondary">
          {indexT("emptyKind")}
        </p>
      ) : (
        <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {places.data.map((place, index) => (
            <li key={place.id}>
              <PlaceCard
                place={place}
                priority={index < 3}
                showProvince={false}
              />
            </li>
          ))}
        </ul>
      )}

      {provinces.length > 1 ? (
        <section
          aria-labelledby="other-provinces"
          className="flex flex-col gap-3"
        >
          <h2
            id="other-provinces"
            className="text-heading-md text-text-primary"
          >
            {t("otherProvinces")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {provinces
              .filter((p) => p.code !== province.code)
              .map((p) => (
                <li key={p.code}>
                  <Tag render={<Link href={`/dia-diem/${p.code}`} />}>
                    {p.name}{" "}
                    <span className="text-text-tertiary tabular-nums">
                      {p.count}
                    </span>
                  </Tag>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
