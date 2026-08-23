import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { LOCALE_COOKIE_NAME, routing } from "@/i18n/routing";

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

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // Skip API routes, static files, and Next internals.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
