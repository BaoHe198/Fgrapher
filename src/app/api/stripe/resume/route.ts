import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { resumeSubscription, StripeNotConfiguredError } from "@/lib/stripe";

const bodySchema = z.object({ role: z.string() });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "role is required" },
        { status: 400 },
      );
    }

    const userRole = await db.userRole.findUnique({
      where: { userId_role: { userId: session.user.id, role: parsed.data.role as never } },
      include: { subscription: true },
    });

    if (!userRole?.subscription?.stripeSubscriptionId) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "No subscription for this role" },
        { status: 404 },
      );
    }

    await resumeSubscription(userRole.subscription.stripeSubscriptionId);

    return NextResponse.json(
      { data: null, error: null, message: "Subscription resumed" },
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
      { data: null, error: "server_error", message: "Failed to resume subscription" },
      { status: 500 },
    );
  }
}
