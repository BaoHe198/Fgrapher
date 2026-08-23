import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { CURRENT_POLICY_VERSION } from "@/lib/constants";
import { updateConsentSchema } from "@/lib/validations/compliance";
import { recordConsent } from "@/services/compliance";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = updateConsentSchema.safeParse(body);
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

    const ipAddress = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const record = await recordConsent({
      userId: session.user.id,
      purpose: parsed.data.purpose,
      granted: parsed.data.granted,
      policyVersion: CURRENT_POLICY_VERSION,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      { data: record, error: null, message: "Preference updated" },
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
        message: "Failed to update preference",
      },
      { status: 500 },
    );
  }
}
