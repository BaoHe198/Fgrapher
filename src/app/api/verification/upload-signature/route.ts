import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  generateKycUploadSignature,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

export async function POST() {
  try {
    const session = await requireAuth();

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          data: null,
          error: "cloudinary_not_configured",
          message:
            "Document uploads are not configured for this environment yet",
        },
        { status: 503 },
      );
    }

    const data = generateKycUploadSignature(session.user.id);

    return NextResponse.json(
      { data, error: null, message: null },
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
        message: "Failed to generate upload signature",
      },
      { status: 500 },
    );
  }
}
