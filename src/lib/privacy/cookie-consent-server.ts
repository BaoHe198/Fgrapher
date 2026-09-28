import { cookies } from "next/headers";

import { CURRENT_POLICY_VERSION } from "@/lib/constants";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_COOKIE_OPTIONS,
  type CookieConsent,
  parseCookieConsent,
  serializeCookieConsent,
} from "@/lib/privacy/cookie-consent";
import {
  PROFILE_VIEW_COOKIE,
  PROFILE_VIEW_COOKIE_PATH,
} from "@/lib/profile-views";

/** The stored choice for this request, or null when none is valid. */
export async function readCookieConsent(): Promise<CookieConsent | null> {
  const store = await cookies();
  return parseCookieConsent(store.get(COOKIE_CONSENT_COOKIE)?.value);
}

/**
 * Stores the choice in this browser. Only from a Route Handler or Server
 * Action — the places Next.js lets write cookies. Saying no also deletes
 * any analytics cookie already set, so withdrawing works immediately
 * rather than when that cookie would have expired.
 */
export async function writeCookieConsent(
  analytics: boolean,
): Promise<CookieConsent> {
  const store = await cookies();
  const consent: CookieConsent = {
    version: CURRENT_POLICY_VERSION,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  store.set(
    COOKIE_CONSENT_COOKIE,
    serializeCookieConsent(consent),
    COOKIE_CONSENT_COOKIE_OPTIONS,
  );
  if (!analytics) {
    store.set(PROFILE_VIEW_COOKIE, "", {
      path: PROFILE_VIEW_COOKIE_PATH,
      maxAge: 0,
    });
  }
  return consent;
}
