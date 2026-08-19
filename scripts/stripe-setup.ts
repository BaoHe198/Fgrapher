// One-time dev script: creates the 5 paid-role Products + monthly Prices in
// your Stripe account and prints the Price IDs to paste into .env.local.
// Run with: npx tsx --env-file=.env scripts/stripe-setup.ts
import Stripe from "stripe";

import { ROLE_LABELS, ROLE_MONTHLY_PRICE } from "../src/lib/constants";

const ROLES = ["PHOTOGRAPHER", "VIDEOGRAPHER", "MAKEUP_ARTIST", "STUDIO", "CAMERA_SHOP"] as const;

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set — add it to .env before running this script.");
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const envLines: string[] = [];

  for (const role of ROLES) {
    const amount = ROLE_MONTHLY_PRICE[role];
    if (!amount) continue;

    const product = await stripe.products.create({
      name: `Fgrapher — ${ROLE_LABELS[role]}`,
    });

    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount * 100,
      recurring: { interval: "month" },
    });

    console.log(`${ROLE_LABELS[role]}: product=${product.id} price=${price.id}`);
    envLines.push(`STRIPE_PRICE_${role}=${price.id}`);
  }

  console.log("\nAdd these to .env.local:\n");
  console.log(envLines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
