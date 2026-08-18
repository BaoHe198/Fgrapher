import { defineRouting } from "next-intl/routing";

export const LOCALE_COOKIE_NAME = "locale";

export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  // No [locale] URL segment — every route built so far (Phase 0 + phase-1
  // Steps 1-6) stays exactly where it is. Locale is resolved purely from a
  // cookie (see src/i18n/request.ts), matching the design's own approach.
  localePrefix: "never",
  // Named to match src/i18n/request.ts and src/i18n/actions.ts, which read
  // and write this cookie directly (outside next-intl's own APIs).
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  },
});
