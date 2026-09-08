import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { LOCALE_COOKIE_NAME, routing } from "@/i18n/routing";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// A hand-rolled proxy instead of next-intl's own createMiddleware(routing):
// that one rewrites every request to a /<locale> path internally even with
// localePrefix: "never" (confirmed via response headers — x-middleware-rewrite
// pointed at http://.../en), because it is built around the App Router's
// [locale] segment convention. This app has no [locale] segment — every
// route from Phase 0 and phase-1 Steps 1-6 stays where it is — so that
// rewrite 404s. This does only what's actually needed: detect a locale from
// Accept-Language on a visitor's first request and persist it as a cookie.
// src/i18n/request.ts reads that cookie directly; no rewriting involved.
//
// Route protection is layered on top here (rather than a separate
// middleware.ts) using next-auth's getToken, which decodes the session JWT
// straight from the request cookie — no DB call, safe to run in this
// runtime, unlike auth() which goes through the Prisma adapter.
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const AUTH_ONLY_PREFIXES = ["/login", "/register"];

// Read directly from process.env rather than lib/env.ts/lib/features.ts —
// this file already reads NEXTAUTH_SECRET the same way, deliberately
// keeping this Edge-runtime file's env footprint minimal rather than
// pulling in the full validated server schema (DATABASE_URL etc.).
const MARKETPLACE_ENABLED = process.env.MARKETPLACE_ENABLED === "true";

// /dashboard/listings, /dashboard/listings/new, etc. (prefix match) —
// every dashboard route this covers already has its own page-level
// notFound() call too, but that alone doesn't produce a real HTTP 404:
// (dashboard)/loading.tsx wraps every page under it in an implicit
// Suspense boundary, which commits the response to 200 before the page's
// notFound() ever runs (see node_modules/next/dist/docs/01-app/02-guides/
// streaming.md's "HTTP contract" section — this Next.js version's docs
// explicitly recommend gating in proxy for exactly this reason). /shop,
// /cart, /checkout don't need to be listed here — the (public) route
// group has no loading.tsx sibling, so their own notFound() calls already
// produce a real 404 status.
const MARKETPLACE_DASHBOARD_PREFIXES = [
  "/dashboard/listings",
  "/dashboard/orders",
  "/dashboard/shop-orders",
];

// Blanket floor for every /api/* route that doesn't already define its
// own tighter limit (register, login, forgot-password, search, phone,
// payment creation — see their own route files/auth.ts). Those keep
// governing their routes since they're stricter; this exists purely to
// close the gap for the ~120 other routes (booking, messaging, reviews,
// portfolio, ...) that had no request-volume limit of any kind — a
// scripted loop against any of them today gets through as fast as the
// network allows. Deliberately generous: the busiest legitimate client
// pattern in this app is the chat panel polling every 2s (30 req/min)
// plus a couple of slower background polls, nowhere close to this.
// Authenticated requests are keyed by user id (fairer than IP — several
// people can legitimately share one IP behind NAT/office wifi); anonymous
// requests fall back to IP, matching every other limiter in this codebase.
const API_DEFAULT_RATE_LIMIT = { max: 300, windowMs: 60 * 1000 };
const API_ANONYMOUS_RATE_LIMIT = { max: 100, windowMs: 60 * 1000 };

// Cron calls (Vercel's own scheduler, already gated by requireCronSecret)
// and payment webhooks (MoMo/ZaloPay/Stripe's own servers, already gated
// by signature verification) are excluded — rate-limiting a trusted
// caller by IP could drop a real delivery during exactly the kind of
// incident where a provider retries quickly, matching the existing
// Stripe webhook route's own "no rate limit" precedent.
const RATE_LIMIT_EXEMPT_PREFIXES = ["/api/cron", "/api/webhooks"];

// Every route in this app only ever receives JSON metadata — actual
// files (portfolio photos, KYC images, chat attachments, ...) upload
// directly from the browser to Cloudinary with a signed URL, never
// through our own API (confirmed by grepping every upload call site
// before writing next.config.ts's CSP connect-src). 1MB is already
// generous headroom for the largest legitimate JSON body this app sends
// (e.g. a profile update with every text field at its Zod .max()).
// This is a fast, best-effort rejection based on the Content-Length
// header a client declares — not a hard guarantee, since a client could
// lie about it or omit it and stream more. The real hard backstop is
// Vercel's own platform-level request body limit (~4.5MB), which exists
// regardless of this check and can't be bypassed by lying about a header.
const API_MAX_BODY_BYTES = 1024 * 1024;

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") &&
    !RATE_LIMIT_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > API_MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          data: null,
          error: "payload_too_large",
          message: "Dữ liệu gửi lên quá lớn.",
        },
        { status: 413 },
      );
    }

    const apiToken = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: request.nextUrl.protocol === "https:",
    });
    const key = apiToken?.id
      ? `api-global:user:${apiToken.id}`
      : `api-global:ip:${getClientIp(request)}`;
    const limit = apiToken?.id
      ? API_DEFAULT_RATE_LIMIT
      : API_ANONYMOUS_RATE_LIMIT;

    const result = checkRateLimit(key, limit);
    if (!result.allowed) {
      return NextResponse.json(
        {
          data: null,
          error: "too_many_requests",
          message: "Bạn thao tác quá nhanh, vui lòng thử lại sau.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfterSeconds) },
        },
      );
    }

    return NextResponse.next();
  }

  if (
    !MARKETPLACE_ENABLED &&
    MARKETPLACE_DASHBOARD_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    // Without this, getToken defaults to looking for the unprefixed
    // "authjs.session-token" cookie — but the auth handler sets the
    // "__Secure-"-prefixed variant whenever the request is HTTPS (i.e. in
    // every deployed environment), so the lookup silently misses every
    // real session and every visitor appears logged out at the edge.
    secureCookie: request.nextUrl.protocol === "https:",
  });

  if (
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !token
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withLocaleCookie(request, NextResponse.redirect(loginUrl));
  }

  if (
    AUTH_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    token
  ) {
    return withLocaleCookie(
      request,
      NextResponse.redirect(new URL("/dashboard", request.url)),
    );
  }

  return withLocaleCookie(request, NextResponse.next());
}

function withLocaleCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.has(LOCALE_COOKIE_NAME)) {
    return response;
  }

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const detected = routing.locales.find((locale) =>
    acceptLanguage.toLowerCase().includes(locale),
  );

  response.cookies.set(LOCALE_COOKIE_NAME, detected ?? routing.defaultLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    // Pages: skip API routes (handled by the second pattern below with
    // different logic), static files, and Next internals.
    "/((?!api|_next|_vercel|.*\\..*).*)",
    // API routes: only the rate-limit/payload-size guard above applies —
    // none of the page-routing logic (PROTECTED_PREFIXES redirect,
    // AUTH_ONLY_PREFIXES bounce, locale cookie) makes sense for a JSON
    // endpoint, and the function returns before reaching any of it.
    "/api/:path*",
  ],
};
