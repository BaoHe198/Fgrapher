import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/api",
        "/checkout",
        "/onboarding",
        "/cart",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
