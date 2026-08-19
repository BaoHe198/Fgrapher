import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // next/image refuses to optimize an external URL unless its host is
    // explicitly allow-listed here — without this, every Cloudinary-hosted
    // avatar/portfolio/product image would 400 the moment real Cloudinary
    // credentials are configured (this environment has none yet, so the
    // gap has stayed silent so far; see CLAUDE.md's Cloudinary note).
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google OAuth avatars
    ],
  },
};

export default withNextIntl(nextConfig);
