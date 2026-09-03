import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Validates process.env against src/lib/env.ts's schema at config-load
// time (before the app boots), so a missing required variable fails the
// build/dev-server startup immediately with a clear message instead of
// surfacing as a confusing runtime error the first time something reads
// process.env directly.
import "./src/lib/env";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

// No nonce-based CSP (Next.js's own recommended stricter approach) — that
// requires forcing every page into dynamic rendering, which conflicts with
// this session's own SSR/caching work on the public/dashboard pages, and
// next-themes' inline dark-mode/FOUC-prevention script would need nonce
// wiring of its own. 'unsafe-inline' is a real, acknowledged weakening
// (an XSS bug could still run an injected inline <script>) — but this still
// blocks the far more common XSS payload shape (loading an external script
// from an attacker-controlled origin), plus object-src/base-uri/form-action/
// frame-ancestors, which this app had zero protection against before.
//
// connect-src includes api.cloudinary.com because uploads (portfolio, KYC,
// chat attachments, product images, account media — see account-media.tsx,
// chat-panel.tsx, product-image-uploader.tsx, upload-media-modal.tsx,
// verification-form.tsx, requests/new/request-wizard.tsx) go straight from
// the browser to Cloudinary's API with a signed upload, not through our own
// backend — confirmed by grepping every fetch()/XMLHttpRequest target in
// src/ before writing this, since guessing wrong here would silently break
// every upload flow in the app.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com;
  font-src 'self' data:;
  connect-src 'self' https://api.cloudinary.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // No `preload` — that's a long-lived commitment to a public browser list
  // that's slow to reverse. Plain HSTS is still enforced by every browser
  // that's ever seen this header from this origin over HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=15552000; includeSubDomains",
  },
];

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
      { protocol: "https", hostname: "images.unsplash.com" }, // landing-page hero decorative photos
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
