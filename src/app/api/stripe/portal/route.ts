import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createPortalSession, StripeNotConfiguredError } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await requireAuth();

    const subscription = await db.subscription.findFirst({
      where: { userRole: { userId: session.user.id }, stripeCustomerId: { not: null } },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "No billing account found" },
        { status: 404 },
      );
    }

    const appUrl = process.env.NEXTAUTH_URL ?? "";
    const portalSession = await createPortalSession(
      subscription.stripeCustomerId,
      `${appUrl}/dashboard/settings/billing`,
    );

    return NextResponse.json(
      { data: { url: portalSession.url }, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json(
        { data: null, error: "not_configured", message: err.message },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to open billing portal" },
      { status: 500 },
    );
  }
}
