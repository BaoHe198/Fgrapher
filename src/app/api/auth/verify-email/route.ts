import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { features } from "@/lib/features";
import {
  type BillingInterval,
  parseBillingInterval,
  resolveOnboardingNext,
} from "@/lib/onboarding-destination";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getPendingPaidRoles,
  verifyEmailToken,
} from "@/services/email-verification";

/**
 * Where to send the user after they sign in.
 *
 * Derived here from the account's own roles rather than carried from
 * registration: registration no longer signs anyone in, so the destination
 * it used to compute was thrown away, leaving a paid provider on
 * /dashboard with an inactive role and nothing prompting them to pay.
 *
 * Only the billing period travels with the user (in the link), because it
 * is a UI choice that never reaches the database. Everything else is read
 * from the record, so nothing here can be steered by whoever holds the
 * link.
 */
async function resolveNextDestination(
  userId: string,
  interval: BillingInterval,
): Promise<string> {
  try {
    return resolveOnboardingNext({
      billingEnabled: features.billingEnabled,
      pendingRoles: await getPendingPaidRoles(userId),
      interval,
    });
  } catch {
    // The account IS verified at this point. Failing to work out where to
    // send them next must not turn that into an error.
    return "/dashboard";
  }
}

const verifyEmailSchema = z.object({
  token: z.string().min(1),
  // Carried from the verification link. Two harmless values, and anything
  // else falls back to "month" rather than being rejected — a mangled
  // preference must not block someone from verifying their account.
  interval: z.enum(["month", "year"]).optional(),
});

// Tokens are 256 bits of randomness, so this isn't holding back a
// realistic brute force — it caps how fast one source can probe the token
// space at all, in line with every other unauthenticated auth route here.
const VERIFY_RATE_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.auth");

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`verify-email:${ip}`, VERIFY_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: t("tooManyRequests") },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = verifyEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: t("verifyEmailInvalid"),
      },
      { status: 400 },
    );
  }

  const result = await verifyEmailToken(parsed.data.token);

  switch (result.status) {
    case "verified":
    case "already_verified":
      // already_verified is not an error: mail clients prefetch links, and
      // people click twice. Both cases get the same onward destination.
      return NextResponse.json(
        {
          data: {
            status: result.status,
            next: await resolveNextDestination(
              result.userId,
              parseBillingInterval(parsed.data.interval),
            ),
          },
          error: null,
          message:
            result.status === "verified"
              ? t("emailVerified")
              : t("emailAlreadyVerified"),
        },
        { status: 200 },
      );
    case "expired":
      return NextResponse.json(
        {
          data: { status: result.status },
          error: "token_expired",
          message: t("verifyEmailExpired"),
        },
        { status: 400 },
      );
    default:
      return NextResponse.json(
        {
          data: { status: "invalid" },
          error: "invalid_token",
          message: t("verifyEmailInvalid"),
        },
        { status: 400 },
      );
  }
}
