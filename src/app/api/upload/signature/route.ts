import { NextResponse } from "next/server";

import { AuthError, requireAuth, requirePaidRole } from "@/lib/auth-helpers";
import { generateUploadSignature, isCloudinaryConfigured } from "@/lib/cloudinary";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    // This route is shared across portfolio media, product images,
    // provider profile photos, and chat image attachments. The first three
    // are paid-role-only (the route that actually persists the reference
    // does the precise per-role subscription check); chat images must stay
    // open to every authenticated user — including CUSTOMER-only accounts
    // messaging a provider — so only they skip the paid-role pre-check.
    const body = await request.json().catch(() => ({}));
    const purpose = body?.purpose === "chat" ? "chat" : "portfolio";
    if (purpose !== "chat") {
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

    const data = generateUploadSignature(`fgrapher/${purpose}/${session.user.id}`);

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
