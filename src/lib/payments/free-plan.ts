/**
 * The free plan providers get while billing is off.
 *
 * With BILLING_ENABLED=false there is nothing to pay and no way to pay it,
 * so a free plan that ran out after its twelve months stranded the provider:
 * the daily expiry cron deactivated their role and unpublished their profile,
 * and every paid-role check refused them in the meantime, with no renewal
 * path anywhere in the product. Project owner, 24/09/2026: while billing is
 * off, the free plan renews itself.
 *
 * Deliberately narrow:
 *  - only plan === "FREE" — a plan paid through MoMo, ZaloPay or a bank
 *    transfer (those rails have their own flags, independent of
 *    BILLING_ENABLED) or one an admin assigned with a chosen end date still
 *    ends when it says it does;
 *  - only local plans — a Stripe subscription's lifecycle is Stripe's;
 *  - only while billing is off — once it is switched on, the free plan is no
 *    longer the whole offer and stops renewing.
 */
export const FREE_PLAN = "FREE";

/** Length of one free-plan term, at signup and at each renewal. */
export const FREE_PLAN_TERM_MONTHS = 12;

export function renewsAutomatically(
  subscription: {
    plan: string | null;
    stripeSubscriptionId?: string | null;
  },
  billingEnabled: boolean,
) {
  return (
    !billingEnabled &&
    subscription.plan === FREE_PLAN &&
    !subscription.stripeSubscriptionId
  );
}

/** End of a free-plan term starting at `from`. */
export function freePlanTermEnd(from: Date) {
  const end = new Date(from);
  end.setMonth(end.getMonth() + FREE_PLAN_TERM_MONTHS);
  return end;
}
