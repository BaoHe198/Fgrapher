import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";

const STATIC_ROUTES = [
  "",
  "/browse",
  "/shop",
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
      where: { isPublished: true, role: { in: PAID_ROLES }, user: { username: { not: null } } },
      select: { updatedAt: true, user: { select: { username: true } } },
    }),
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, updatedAt: true },
    }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
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
