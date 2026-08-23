import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { cancelSubscription, StripeNotConfiguredError } from "@/lib/stripe";

const bodySchema = z.object({ role: z.string() });

// Dormant while BILLING_ENABLED=false — see CLAUDE.md.
export async function POST(request: Request) {
  if (!features.billingEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

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
      where: {
        userId_role: {
          userId: session.user.id,
          role: parsed.data.role as never,
        },
      },
      include: { subscription: true },
    });

    if (!userRole?.subscription?.stripeSubscriptionId) {
      return NextResponse.json(
        {
          data: null,
          error: "not_found",
          message: "No active subscription for this role",
        },
        { status: 404 },
      );
    }

    await cancelSubscription(userRole.subscription.stripeSubscriptionId, false);
    // The webhook (customer.subscription.updated) will persist
    // cancelAtPeriodEnd once Stripe confirms it — this just triggers it.

    return NextResponse.json(
      {
        data: null,
        error: null,
        message: "Subscription set to cancel at period end",
      },
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
      {
        data: null,
        error: "server_error",
        message: "Failed to cancel subscription",
      },
      { status: 500 },
    );
  }
}
