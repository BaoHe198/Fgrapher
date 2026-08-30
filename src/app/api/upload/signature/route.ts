import { NextResponse } from "next/server";

import { AuthError, requireAuth, requirePaidRole } from "@/lib/auth-helpers";
import {
  generateUploadSignature,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    // This route is shared across portfolio media, product images,
    // provider profile photos, chat image attachments, and (Prompt G7)
    // ServiceRequest reference photos. Portfolio/products/profile photos
    // are paid-role-only (the route that actually persists the reference
    // does the precise per-role subscription check); chat images and
    // request references must stay open to every authenticated user —
    // including CUSTOMER-only accounts, who have no paid role at all — so
    // only those two skip the paid-role pre-check.
    const body = await request.json().catch(() => ({}));
    const openPurposes = new Set(["chat", "request"]);
    const purpose = openPurposes.has(body?.purpose)
      ? body.purpose
      : "portfolio";
    if (!openPurposes.has(purpose)) {
      await requirePaidRole(session.user.id);
    }

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

    const data = generateUploadSignature(
      `fgrapher/${purpose}/${session.user.id}`,
    );

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
