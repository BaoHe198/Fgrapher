// One-time dev script: creates the 5 paid-role Products + a monthly and a
// yearly (20% off) Price for each in your Stripe account, and prints the
// Price IDs to paste into .env.local.
// Run with: npx tsx --env-file=.env scripts/stripe-setup.ts
import Stripe from "stripe";

import { ROLE_LABELS } from "../src/lib/constants";
import { ROLE_PLANS } from "../src/lib/constants/plans";
import { toStripeAmount } from "../src/lib/stripe";

const ROLES = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "CAMERA_SHOP",
] as const;

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error(
      "STRIPE_SECRET_KEY is not set — add it to .env before running this script.",
    );
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const envLines: string[] = [];

  for (const role of ROLES) {
    const plan = ROLE_PLANS[role];
    if (!plan) continue;

    const product = await stripe.products.create({
      name: `Fgrapher — ${ROLE_LABELS[role]}`,
    });

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: plan.currency.toLowerCase(),
      unit_amount: toStripeAmount(plan.monthly, plan.currency),
      recurring: { interval: "month" },
    });

    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      currency: plan.currency.toLowerCase(),
      unit_amount: toStripeAmount(plan.yearly, plan.currency),
      recurring: { interval: "year" },
    });

    console.log(
      `${ROLE_LABELS[role]}: product=${product.id} monthly=${monthlyPrice.id} yearly=${yearlyPrice.id}`,
    );
    envLines.push(`STRIPE_PRICE_${role}_MONTHLY=${monthlyPrice.id}`);
    envLines.push(`STRIPE_PRICE_${role}_YEARLY=${yearlyPrice.id}`);
  }

  console.log("\nAdd these to .env.local:\n");
  console.log(envLines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
