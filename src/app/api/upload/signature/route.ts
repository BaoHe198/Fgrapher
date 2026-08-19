import { NextResponse } from "next/server";

import { AuthError, requireAuth, requirePaidRole } from "@/lib/auth-helpers";
import { generateUploadSignature, isCloudinaryConfigured } from "@/lib/cloudinary";

export async function POST() {
  try {
    const session = await requireAuth();
    // This route is shared across portfolio media, product images, and
    // provider profile photos — it can't know which specific role the
    // upload is for, so it only checks "some paid role is usable." The
    // route that actually persists the reference (portfolio/products POST)
    // does the precise per-role subscription check.
    await requirePaidRole(session.user.id);

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
