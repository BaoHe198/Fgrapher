import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { CURRENT_POLICY_VERSION } from "@/lib/constants";
import { db } from "@/lib/db";
import { completeProfileSchema } from "@/lib/validations/auth";
import { recordConsent } from "@/services/compliance";

// Closes the gap documented in PRE_LAUNCH_REVIEW.md — Google OAuth signups
// never go through /api/auth/register, so they had no age-gate enforcement
// (CLAUDE.md rule 4) and no ConsentRecord rows at all (rule 6). This is the
// equivalent step, gated onto first dashboard visit by
// (dashboard)/layout.tsx rather than at signup.
export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = completeProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    const { dateOfBirth, consentService, consentMarketing, consentAnalytics } =
      parsed.data;

    const ipAddress = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    const userAgent = request.headers.get("user-agent") ?? undefined;

    await db.user.update({
      where: { id: session.user.id },
      data: { dateOfBirth: new Date(dateOfBirth) },
    });

    // Same "record every purpose, including declines" pattern as
    // /api/auth/register — a complete evidence trail of what was actually
    // presented and chosen, not just the grants.
    await Promise.all([
      recordConsent({
        userId: session.user.id,
        purpose: "SERVICE",
        granted: consentService,
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress,
        userAgent,
      }),
      recordConsent({
        userId: session.user.id,
        purpose: "MARKETING",
        granted: consentMarketing,
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress,
        userAgent,
      }),
      recordConsent({
        userId: session.user.id,
        purpose: "ANALYTICS",
        granted: consentAnalytics,
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress,
        userAgent,
      }),
    ]);

    return NextResponse.json(
      { data: { ok: true }, error: null, message: "Profile completed" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: "Failed to save your details",
      },
      { status: 500 },
    );
  }
}
