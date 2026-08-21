import type { Role } from "@prisma/client";

import { ROLE_LABELS } from "./index";

export type BillingInterval = "month" | "year";

const YEARLY_DISCOUNT = 0.2;

export interface RolePlan {
  role: Role;
  name: string;
  currency: "VND";
  // VND, whole currency units — VND is a zero-decimal currency (see
  // toStripeAmount in lib/stripe.ts), so these are the exact amounts
  // charged, not cents. `yearly` already has the 20% discount applied
  // (monthly * 12 * 0.8) — it's the total charged once a year, not a
  // monthly-equivalent figure.
  monthly: number;
  yearly: number;
  // Undefined until `scripts/stripe-setup.ts` has been run and the
  // resulting STRIPE_PRICE_<ROLE>_MONTHLY/YEARLY env vars are set — reading
  // these pulls in non-NEXT_PUBLIC env vars, so only import this from
  // server code (the checkout route, webhook sync, and server-rendered
  // pricing/billing pages), never from a Client Component.
  monthlyPriceId: string | undefined;
  yearlyPriceId: string | undefined;
}

function plan(role: Role, name: string, monthly: number, envPrefix: string): RolePlan {
  return {
    role,
    name,
    currency: "VND",
    monthly,
    yearly: Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT)),
    monthlyPriceId: process.env[`STRIPE_PRICE_${envPrefix}_MONTHLY`],
    yearlyPriceId: process.env[`STRIPE_PRICE_${envPrefix}_YEARLY`],
  };
}

// Single source of truth for what each paid role costs and which Stripe
// Price objects represent it. Billing currency is VND: provider service
// prices, booking totals, and marketplace listings are already all VND
// (see formatCurrency's VND default in lib/utils.ts) — billing subscriptions
// in USD was the actual inconsistency, not a deliberate split.
export const ROLE_PLANS: Partial<Record<Role, RolePlan>> = {
  PHOTOGRAPHER: plan("PHOTOGRAPHER", ROLE_LABELS.PHOTOGRAPHER, 390_000, "PHOTOGRAPHER"),
  VIDEOGRAPHER: plan("VIDEOGRAPHER", ROLE_LABELS.VIDEOGRAPHER, 390_000, "VIDEOGRAPHER"),
  MAKEUP_ARTIST: plan("MAKEUP_ARTIST", ROLE_LABELS.MAKEUP_ARTIST, 390_000, "MAKEUP_ARTIST"),
  CAMERA_SHOP: plan("CAMERA_SHOP", ROLE_LABELS.CAMERA_SHOP, 490_000, "CAMERA_SHOP"),
  STUDIO: plan("STUDIO", ROLE_LABELS.STUDIO, 690_000, "STUDIO"),
};

export function priceIdForRole(role: Role, interval: BillingInterval) {
  const p = ROLE_PLANS[role];
  if (!p) return undefined;
  return interval === "year" ? p.yearlyPriceId : p.monthlyPriceId;
}

export function intervalForPriceId(priceId: string): BillingInterval | undefined {
  for (const p of Object.values(ROLE_PLANS)) {
    if (p?.monthlyPriceId === priceId) return "month";
    if (p?.yearlyPriceId === priceId) return "year";
  }
  return undefined;
}

export function minMonthlyPrice() {
  return Math.min(...Object.values(ROLE_PLANS).map((p) => p!.monthly));
}

// Plain role -> price map with no Stripe IDs or env access — safe to pass
// as a prop from a server component down into a Client Component (unlike
// ROLE_PLANS itself, which must stay server-only).
export function rolePricesVnd(interval: BillingInterval = "month"): Partial<Record<Role, number>> {
  return Object.fromEntries(
    Object.entries(ROLE_PLANS).map(([role, p]) => [role, interval === "year" ? p!.yearly : p!.monthly]),
  ) as Partial<Record<Role, number>>;
}
