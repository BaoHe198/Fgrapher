"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE_NAME, routing } from "@/i18n/routing";

export async function setLocale(locale: (typeof routing.locales)[number]) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
