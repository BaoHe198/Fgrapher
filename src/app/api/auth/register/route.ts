import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { CURRENT_POLICY_VERSION } from "@/lib/constants";
import { features } from "@/lib/features";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getRegisterSchema } from "@/lib/validations/auth";
import { recordConsent } from "@/services/compliance";
import { sendVerificationEmail } from "@/services/email-verification";
import { assignFreePlan } from "@/services/subscription";
import { Prisma } from "@prisma/client";

// Registration hits the DB unconditionally (email-uniqueness check, user
// insert) with no auth gate at all — a scripted loop had zero resistance
// before this. 5 per 15 minutes per IP is generous for a real person
// signing up, tight for an automated loop.
const REGISTER_RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };

export async function POST(request: Request) {
  const [t, tValidation] = await Promise.all([
    getTranslations("apiMessages.auth"),
    getTranslations("libServices.validation.auth"),
  ]);

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`register:${ip}`, REGISTER_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: t("tooManyRequests") },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json();
  const parsed = getRegisterSchema(tValidation).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: parsed.error.issues[0]?.message ?? t("invalidInput"),
      },
      { status: 400 },
    );
  }

  const {
    name,
    email,
    password,
    roles,
    dateOfBirth,
    acceptedContentGuidelines,
    consentService,
    consentMarketing,
    consentAnalytics,
  } = parsed.data;

  // registerSchema's role list can't read the runtime feature flag (it's
  // built at module scope), so CAMERA_SHOP is checked here instead — the
  // registration UI already hides it while MARKETPLACE_ENABLED=false (see
  // CLAUDE.md), but a direct API call could otherwise still create an
  // active-looking CAMERA_SHOP role and a publishable, searchable profile.
  if (!features.marketplaceEnabled && roles.includes("CAMERA_SHOP")) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: t("cameraShopUnavailable"),
      },
      { status: 400 },
    );
  }
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(" ") || null;

  // Best-effort — used only to timestamp the consent record, never to
  // gate registration itself. x-forwarded-for is a comma-separated list
  // when the request passed through multiple proxies; the first entry is
  // the original client.
  const ipAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      {
        data: null,
        error: "email_taken",
        message: t("emailTaken"),
      },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const uniqueRoles = Array.from(new Set(roles));

    const user = await db.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: name.trim(),
        passwordHash,
        // Deliberately NOT set: a credential signup has not yet proven it
        // controls this address. lib/auth.ts's authorize() refuses to sign
        // in an account with a null emailVerified, and the verification
        // email below is what clears it. (OAuth signups are unaffected —
        // the provider has already verified the address and the Prisma
        // adapter stamps this at account link time.)
        // Age gate (Prompt B3) — required for every account; registerSchema
        // already enforced >= 18 before this route runs.
        dateOfBirth: new Date(dateOfBirth),
        roles: {
          create: [
            { role: "CUSTOMER", active: true },
            // Paid roles start inactive until a subscription is created —
            // either by Stripe Checkout completing (BILLING_ENABLED=true)
            // or, while billing is disabled, immediately below via
            // assignFreePlan.
            ...uniqueRoles.map((role) => ({
              role,
              active: false,
              ...(role === "MODEL" && acceptedContentGuidelines
                ? { contentGuidelinesAcceptedAt: new Date() }
                : {}),
            })),
          ],
        },
      },
    });

    // Three separate ConsentRecord rows, always — including for the two
    // optional purposes even when declined, so there's a complete record
    // of what was actually presented and chosen at signup, not just the
    // grants. consentService is guaranteed true here (registerSchema
    // already refined on it), never a request-body gate on its own.
    await Promise.all([
      recordConsent({
        userId: user.id,
        purpose: "SERVICE",
        granted: consentService,
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress,
        userAgent,
      }),
      recordConsent({
        userId: user.id,
        purpose: "MARKETING",
        granted: consentMarketing,
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress,
        userAgent,
      }),
      recordConsent({
        userId: user.id,
        purpose: "ANALYTICS",
        granted: consentAnalytics,
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress,
        userAgent,
      }),
    ]);

    // Free-granting is its own switch (freeRoleGrantEnabled), separate
    // from billingEnabled — see src/lib/features.ts's comment. Today
    // that means: while Stripe is off (it can't take a Vietnam-
    // registered merchant account — CLAUDE.md) AND the free-grant switch
    // is on (its default), every paid role gets a free 12-month plan
    // immediately instead of being routed through Stripe Checkout.
    // onboarding/billing redirects straight past its own step when
    // billingEnabled is off, so this is the only place that activates
    // these roles in that case. Turning on a local payment rail (MoMo/
    // ZaloPay/bank transfer) does NOT by itself stop this — that's a
    // separate, deliberate decision via FREE_ROLE_GRANT_ENABLED.
    if (
      !features.billingEnabled &&
      features.freeRoleGrantEnabled &&
      uniqueRoles.length > 0
    ) {
      await assignFreePlan(user.id, uniqueRoles);
    }

    // After the consent records and the free-plan grant, so a failure here
    // can't leave a half-registered account — and it can't fail the
    // registration either: sendVerificationEmail() swallows its own errors
    // and the outbox retries, with the resend endpoint as the manual
    // fallback. The account exists regardless; it just can't sign in yet.
    await sendVerificationEmail({ userId: user.id, email: user.email });

    return NextResponse.json(
      {
        data: {
          id: user.id,
          email: user.email,
          // Tells the client to show "check your inbox" instead of
          // signing in, which would now bounce off the authorize() gate.
          verificationRequired: true,
        },
        error: null,
        message: t("accountCreatedVerifyEmail"),
      },
      { status: 201 },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          data: null,
          error: "email_taken",
          message: t("emailTaken"),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: t("accountCreateFailed"),
      },
      { status: 500 },
    );
  }
}
