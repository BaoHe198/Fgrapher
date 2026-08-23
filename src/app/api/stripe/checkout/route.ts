import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { priceIdForRole } from "@/lib/constants/plans";
import { features } from "@/lib/features";
import {
  createCheckoutSession,
  getOrCreateCustomer,
  StripeNotConfiguredError,
} from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations/subscription";

// Dormant while BILLING_ENABLED=false — see CLAUDE.md. Registration
// assigns FREE plans directly (services/subscription.ts's
// assignFreePlan) without ever reaching this route while the flag is
// off; this guard is the backstop for anyone hitting it directly.
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
    const parsed = checkoutSchema.safeParse(body);
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

    const lineItems = parsed.data.roles
      .map((role) => priceIdForRole(role, parsed.data.interval))
      .filter((priceId): priceId is string => Boolean(priceId))
      .map((priceId) => ({ price: priceId, quantity: 1 }));

    if (lineItems.length === 0) {
      return NextResponse.json(
        {
          data: null,
          error: "not_configured",
          message:
            "No Stripe price is configured for the selected role(s) yet.",
        },
        { status: 503 },
      );
    }

    const user = await db.user.findUniqueOrThrow({
      where: { id: session.user.id },
    });
    const customer = await getOrCreateCustomer(
      user.id,
      user.email,
      user.firstName ?? user.name,
    );

    const appUrl = process.env.NEXTAUTH_URL ?? "";
    const checkoutSession = await createCheckoutSession({
      customerId: customer.id,
      lineItems,
      metadata: { userId: user.id, roles: parsed.data.roles.join(",") },
      successUrl: `${appUrl}/dashboard?checkout=success`,
      cancelUrl: `${appUrl}/onboarding/billing?checkout=cancelled&roles=${parsed.data.roles.join(",")}&interval=${parsed.data.interval}`,
    });

    return NextResponse.json(
      { data: { url: checkoutSession.url }, error: null, message: null },
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
        message: "Failed to start checkout",
      },
      { status: 500 },
    );
  }
}
