import { NextResponse } from "next/server";

import { AuthError, requireAnyRole, requireAuth } from "@/lib/auth-helpers";
import { generateUploadSignature, isCloudinaryConfigured } from "@/lib/cloudinary";
import { PAID_ROLES } from "@/lib/constants";

export async function POST() {
  try {
    const session = await requireAuth();
    requireAnyRole(session, PAID_ROLES);

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          data: null,
          error: "cloudinary_not_configured",
          message: "Media uploads are not configured for this environment yet",
        },
        { status: 503 },
      );
    }

    const data = generateUploadSignature(`fgrapher/portfolio/${session.user.id}`);

    return NextResponse.json({ data, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to generate upload signature" },
      { status: 500 },
    );
  }
}
