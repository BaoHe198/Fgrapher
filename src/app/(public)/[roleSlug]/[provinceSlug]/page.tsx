import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArtistCard } from "@/components/cards/artist-card";
import { db } from "@/lib/db";
import { ROLE_SLUGS, SLUG_TO_ROLE } from "@/lib/constants";
import { features } from "@/lib/features";
import { formatCurrency } from "@/lib/utils";
import { searchProfiles } from "@/services/search";

interface PageProps {
  params: Promise<{ roleSlug: string; provinceSlug: string }>;
}

// Prompt B4, VIỆC 5 — "kênh khách tự nhiên quan trọng nhất": SEO landing
// pages for every (role, province) combination, e.g. /photographer/tp-ho-chi-minh.
// Static params are generated from real Province rows (CLAUDE.md mục 9 —
// no hardcoded province list), so this scales to 0 extra code the moment
// more provinces are seeded (see prisma/data/provinces-registry.ts).
export async function generateStaticParams() {
  const provinces = await db.province.findMany({ select: { code: true } });
  const roleSlugs = Object.entries(ROLE_SLUGS).filter(
    ([role]) => role !== "CAMERA_SHOP" || features.marketplaceEnabled,
  );

  return roleSlugs.flatMap(([, roleSlug]) =>
    provinces.map((province) => ({
      roleSlug: roleSlug as string,
      provinceSlug: province.code,
    })),
  );
}

async function resolveParams(roleSlug: string, provinceSlug: string) {
  const role = SLUG_TO_ROLE[roleSlug];
  if (!role) return null;
  if (role === "CAMERA_SHOP" && !features.marketplaceEnabled) return null;

  const province = await db.province.findUnique({
    where: { code: provinceSlug },
    select: { id: true, code: true, name: true },
  });
  if (!province) return null;

  return { role, province };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { roleSlug, provinceSlug } = await params;
  const resolved = await resolveParams(roleSlug, provinceSlug);
  if (!resolved) return {};

  const [t, roleT] = await Promise.all([
    getTranslations("publicPages.roleProvinceLanding"),
    getTranslations("role"),
  ]);
  const values = {
    role: roleT(resolved.role),
    province: resolved.province.name,
  };
  const title = t("metaTitle", values);
  const description = t("metaDescription", values);

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function RoleProvinceLandingPage({ params }: PageProps) {
  const { roleSlug, provinceSlug } = await params;
  const resolved = await resolveParams(roleSlug, provinceSlug);
  if (!resolved) {
    notFound();
  }

  const [t, tBrowse, roleT, result] = await Promise.all([
    getTranslations("publicPages.roleProvinceLanding"),
    getTranslations("publicPages.browse"),
    getTranslations("role"),
    searchProfiles({
      roles: [resolved.role],
      city: resolved.province.code,
      limit: 24,
    }),
  ]);

  const values = {
    role: roleT(resolved.role),
    province: resolved.province.name,
  };
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("heading", values),
    description: t("metaDescription", values),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: result.data.map((profile, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${baseUrl}/profile/${profile.user.username}`,
        name: profile.displayName ?? profile.user.name ?? undefined,
      })),
    },
  };

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-8 pb-[72px] sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-display-md text-text-primary">
        {t("heading", values)}
      </h1>
      <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
        {t("intro", values)}
      </p>

      {result.data.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-body-lg font-semibold text-text-primary">
            {t("empty.heading", values)}
          </p>
          <p className="text-body-md text-text-secondary">{t("empty.body")}</p>
          <Link href="/browse" className="text-text-link hover:underline">
            {t("empty.browseAll")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {result.data.map((profile) => (
            <ArtistCard
              key={profile.userId}
              artist={{
                id: profile.userId,
                name:
                  profile.displayName ??
                  profile.user.name ??
                  tBrowse("unnamed"),
                username: profile.user.username ?? "",
                roles: profile.roles.map((role) => roleT(role)),
                city: profile.user.location ?? "",
                rating:
                  profile.avgRating > 0
                    ? profile.avgRating.toFixed(1)
                    : tBrowse("newBadge"),
                reviews: profile.reviewCount,
                price: profile.priceMin
                  ? tBrowse("priceFrom", {
                      price: formatCurrency(profile.priceMin),
                    })
                  : tBrowse("contactForPricing"),
                coverImage: profile.media[0]?.url,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
