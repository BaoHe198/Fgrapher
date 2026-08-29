import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { CURRENT_POLICY_VERSION } from "@/lib/constants";
import { features } from "@/lib/features";
import { getRegisterSchema } from "@/lib/validations/auth";
import { recordConsent } from "@/services/compliance";
import { assignFreePlan } from "@/services/subscription";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  const [t, tValidation] = await Promise.all([
    getTranslations("apiMessages.auth"),
    getTranslations("libServices.validation.auth"),
  ]);
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
        // No email-delivery provider is wired up yet (phase 0); treat
        // registrations as verified until a real verification flow exists.
        emailVerified: new Date(),
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

    // BILLING_ENABLED=false (Stripe can't take a Vietnam-registered
    // merchant account — see CLAUDE.md): every paid role gets a free
    // 12-month plan immediately instead of being routed through Stripe
    // Checkout. onboarding/billing redirects straight past its own step
    // when this flag is off, so this is the only place that activates
    // these roles in that case.
    if (!features.billingEnabled && uniqueRoles.length > 0) {
      await assignFreePlan(user.id, uniqueRoles);
    }

    return NextResponse.json(
      {
        data: { id: user.id, email: user.email },
        error: null,
        message: t("accountCreated"),
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
