import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export async function GET() {
  try {
    const session = await requireAuth();

    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json({ data: [], error: null, message: null }, { status: 200 });
    }

    const subscription = await db.subscription.findFirst({
      where: { userRole: { userId: session.user.id }, stripeCustomerId: { not: null } },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ data: [], error: null, message: null }, { status: 200 });
    }

    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 20,
    });

    const data = invoices.data.map((invoice) => ({
      id: invoice.id,
      date: invoice.created * 1000,
      description:
        invoice.lines.data.map((l) => l.description).filter(Boolean).join(", ") ||
        "Fgrapher subscription",
      amount: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      hostedUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf,
    }));

    return NextResponse.json({ data, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load invoices" },
      { status: 500 },
    );
  }
}
