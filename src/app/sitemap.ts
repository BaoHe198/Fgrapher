import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";

const STATIC_ROUTES = [
  "",
  "/browse",
  "/pricing",
  "/about",
  "/help",
  "/contact",
  "/terms",
  "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const [profiles, products] = await Promise.all([
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

  return [...staticEntries, ...profileEntries, ...productEntries];
}
