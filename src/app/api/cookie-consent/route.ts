import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { CURRENT_POLICY_VERSION } from "@/lib/constants";
import { writeCookieConsent } from "@/lib/privacy/cookie-consent-server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { cookieConsentSchema } from "@/lib/validations/compliance";
import { recordConsent } from "@/services/compliance";

// Open to signed-out visitors — the banner shows before anyone signs in —
// so it gets a per-IP ceiling like every other unauthenticated write.
const COOKIE_CONSENT_RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 };

/**
 * Saves the cookie banner's choice in this browser. For a signed-in user it
 * is also their ANALYTICS consent, so it is recorded as a ConsentRecord
 * (timestamp, policy version, IP, user agent) — the same evidence the
 * registration form and /dashboard/settings/data leave. A signed-out
 * visitor's choice lives only in their browser: there is no account to
 * attach a record to.
 */
export async function POST(request: Request) {
  const t = await getTranslations("cookieConsent");

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(
    `cookie-consent:${ip}`,
    COOKIE_CONSENT_RATE_LIMIT,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: t("saveFailed") },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const parsed = cookieConsentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("saveFailed") },
        { status: 400 },
      );
    }

    const consent = await writeCookieConsent(parsed.data.analytics);

    const session = await auth();
    if (session?.user?.id) {
      await recordConsent({
        userId: session.user.id,
        purpose: "ANALYTICS",
        granted: parsed.data.analytics,
        policyVersion: CURRENT_POLICY_VERSION,
        ...getRequestMeta(request),
      });
    }

    return NextResponse.json(
      { data: { analytics: consent.analytics }, error: null, message: null },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: t("saveFailed") },
      { status: 500 },
    );
  }
}
