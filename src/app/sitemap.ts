import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { DISCOVERABLE_ROLES, PAID_ROLES, ROLE_SLUGS } from "@/lib/constants";
import { features } from "@/lib/features";
import { placeProvinces, placesForSitemap } from "@/services/places";

// Rebuilt hourly. Without this the sitemap was generated once at build time
// and then frozen: a provider who published after a deploy never reached it,
// and a product deleted since still sat in it as a link to a 404.
export const revalidate = 3600;

const STATIC_ROUTES = [
  "",
  "/browse",
  "/pricing",
  "/about",
  "/help",
  "/contact",
  "/guide",
  "/guidelines",
  "/terms",
  "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const [profiles, products, provinces, places, placeProvinceList] =
    await Promise.all([
      db.profile.findMany({
        where: {
          isPublished: true,
          role: { in: PAID_ROLES },
          // A suspended or soft-deleted owner's profile is not public — keep it
          // out of the sitemap too (soft-delete also nulls the username, but be
          // explicit). Matches services/search.ts's PUBLIC_USER_FILTER.
          user: {
            username: { not: null },
            deletedAt: null,
            isSuspended: false,
          },
        },
        select: { updatedAt: true, user: { select: { username: true } } },
      }),
      // Marketplace product pages 404 while MARKETPLACE_ENABLED=false —
      // listing them here would tell search engines about URLs that don't
      // resolve.
      features.marketplaceEnabled
        ? db.product.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true, updatedAt: true },
          })
        : Promise.resolve([]),
      // Prompt B4, VIỆC 5 — every (role, province) landing page.
      db.province.findMany({ select: { code: true } }),
      // Photo spots: the same "public" rule as their pages (services/
      // places.ts PUBLIC_PLACE), so no listed address is a 404.
      placesForSitemap(),
      placeProvinces(),
    ]);

  const staticRoutes = features.marketplaceEnabled
    ? [...STATIC_ROUTES, "/shop"]
    : STATIC_ROUTES;
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const profileEntries: MetadataRoute.Sitemap = profiles
    .filter((p) => p.user.username)
    .map((p) => ({
      url: `${baseUrl}/profile/${p.user.username}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/shop/${product.id}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const roleSlugs = Object.entries(ROLE_SLUGS).filter(([role]) =>
    DISCOVERABLE_ROLES.includes(role as (typeof DISCOVERABLE_ROLES)[number]),
  );
  const landingEntries: MetadataRoute.Sitemap = roleSlugs.flatMap(
    ([, roleSlug]) =>
      provinces.map((province) => ({
        url: `${baseUrl}/${roleSlug}/${province.code}`,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      })),
  );

  // /dia-diem and each province page exist only once they have a spot.
  const placeEntries: MetadataRoute.Sitemap =
    places.length === 0
      ? []
      : [
          {
            url: `${baseUrl}/dia-diem`,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          },
          ...placeProvinceList.map((province) => ({
            url: `${baseUrl}/dia-diem/${province.code}`,
            changeFrequency: "weekly" as const,
            priority: 0.65,
          })),
          ...places.map((place) => ({
            url: `${baseUrl}${place.href}`,
            lastModified: place.updatedAt,
            changeFrequency: "monthly" as const,
            priority: 0.6,
          })),
        ];

  return [
    ...staticEntries,
    ...profileEntries,
    ...productEntries,
    ...landingEntries,
    ...placeEntries,
  ];
}
