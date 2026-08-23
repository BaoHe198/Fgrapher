import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { submitVerificationSchema } from "@/lib/validations/verification";
import { submitVerification, VerificationError } from "@/services/verification";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = submitVerificationSchema.safeParse(body);
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

    const {
      role,
      idNumber,
      idFrontUrl,
      idFrontPublicId,
      idBackUrl,
      idBackPublicId,
      selfieUrl,
      selfiePublicId,
    } = parsed.data;
    const userRole = await submitVerification({
      userId: session.user.id,
      role,
      idNumber,
      idFrontUrl,
      idFrontPublicId,
      idBackUrl,
      idBackPublicId,
      selfieUrl,
      selfiePublicId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      { data: userRole, error: null, message: "Verification submitted" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof VerificationError) {
      return NextResponse.json(
        { data: null, error: "invalid_state", message: err.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: "Failed to submit verification",
      },
      { status: 500 },
    );
  }
}
