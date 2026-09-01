import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { PAID_ROLES, ROLE_SLUGS } from "@/lib/constants";
import { features } from "@/lib/features";

const STATIC_ROUTES = [
  "",
  "/browse",
  "/pricing",
  "/about",
  "/help",
  "/contact",
  "/guidelines",
  "/terms",
  "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const [profiles, products, provinces] = await Promise.all([
    db.profile.findMany({
      where: {
        isPublished: true,
        role: { in: PAID_ROLES },
        user: { username: { not: null } },
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

  const roleSlugs = Object.entries(ROLE_SLUGS).filter(
    ([role]) => role !== "CAMERA_SHOP" || features.marketplaceEnabled,
  );
  const landingEntries: MetadataRoute.Sitemap = roleSlugs.flatMap(
    ([, roleSlug]) =>
      provinces.map((province) => ({
        url: `${baseUrl}/${roleSlug}/${province.code}`,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      })),
  );

  return [
    ...staticEntries,
    ...profileEntries,
    ...productEntries,
    ...landingEntries,
  ];
}
