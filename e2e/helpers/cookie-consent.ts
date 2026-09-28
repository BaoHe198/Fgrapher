import { CURRENT_POLICY_VERSION } from "../../src/lib/constants";
import {
  COOKIE_CONSENT_COOKIE,
  serializeCookieConsent,
} from "../../src/lib/privacy/cookie-consent";

/**
 * A browser that already answered the cookie banner ("necessary only").
 * The banner sits over the bottom-left of every page until answered, which
 * would cover buttons the specs click; every spec except the banner's own
 * starts from this state (playwright.config.ts `use.storageState`).
 */
export function cookieConsentState(baseURL: string) {
  const url = new URL(baseURL);
  return {
    cookies: [
      {
        name: COOKIE_CONSENT_COOKIE,
        value: serializeCookieConsent({
          version: CURRENT_POLICY_VERSION,
          analytics: false,
          decidedAt: new Date().toISOString(),
        }),
        domain: url.hostname,
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
}
