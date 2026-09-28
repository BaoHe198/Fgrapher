import { CURRENT_POLICY_VERSION } from "@/lib/constants";

/**
 * The visitor's cookie choice, remembered in this browser.
 *
 * Two categories only, because that is all the site sets today:
 *  - necessary (sign-in session, CSRF, language): always on — the site does
 *    not work without them, so they are disclosed, not asked for.
 *  - analytics: the `fg_pv` profile-view cookie. Off until the visitor
 *    says yes; never pre-ticked (CLAUDE.md rule 6).
 *
 * Adding a tracker later (Google Analytics, a pixel, Vercel Analytics with
 * cookies) means adding it behind `analytics` here — or a new category with
 * its own switch, never folded into an existing one.
 *
 * The choice is tied to CURRENT_POLICY_VERSION: when the policy changes,
 * every stored choice stops parsing and the banner asks again.
 */

export const COOKIE_CONSENT_COOKIE = "fg_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/** Fired on window to reopen the banner from the footer's "Cài đặt cookie". */
export const OPEN_COOKIE_SETTINGS_EVENT = "fg:open-cookie-settings";

export interface CookieConsent {
  version: string;
  analytics: boolean;
  /** ISO timestamp of the choice. */
  decidedAt: string;
}

export function serializeCookieConsent(consent: CookieConsent): string {
  return JSON.stringify({
    v: consent.version,
    a: consent.analytics ? 1 : 0,
    t: consent.decidedAt,
  });
}

/**
 * Anything missing, malformed or recorded under an older policy version
 * reads as "not decided yet", so the banner shows again.
 */
export function parseCookieConsent(
  raw: string | undefined,
  currentVersion: string = CURRENT_POLICY_VERSION,
): CookieConsent | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { v, a, t } = value as Record<string, unknown>;
    if (v !== currentVersion) return null;
    if (a !== 0 && a !== 1) return null;
    if (typeof t !== "string" || Number.isNaN(Date.parse(t))) return null;
    return { version: v, analytics: a === 1, decidedAt: t };
  } catch {
    return null;
  }
}

export function hasAnalyticsCookieConsent(raw: string | undefined): boolean {
  return parseCookieConsent(raw)?.analytics ?? false;
}

export const COOKIE_CONSENT_COOKIE_OPTIONS = {
  path: "/",
  maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
  // Only the server reads it (the root layout decides whether to show the
  // banner), so script on the page has no reason to touch it.
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
