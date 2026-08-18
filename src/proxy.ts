import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
export default function proxy(request: NextRequest) {
  if (request.cookies.has(LOCALE_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const detected = routing.locales.find((locale) =>
    acceptLanguage.toLowerCase().includes(locale),
  );

  const response = NextResponse.next();
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
