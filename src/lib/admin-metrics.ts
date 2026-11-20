import type { Role } from "@prisma/client";

import { ROLE_PLANS } from "@/lib/constants/plans";
import { FREE_PLAN } from "@/lib/payments/free-plan";

export interface RevenueSubscription {
  plan: string | null;
  interval: string;
  role: Role;
}

/**
 * What the active plans bring in per month, in VND.
 *
 * Free plans bring in nothing. The overview used to add the role's monthly
 * list price for every active plan whatever it was, so with every provider
 * on the free plan it still reported millions a month in recurring revenue.
 * A yearly plan is charged once a year at a discount, so it counts for a
 * twelfth of that, not for the monthly list price.
 */
export function monthlyRecurringRevenue(subscriptions: RevenueSubscription[]) {
  return subscriptions.reduce((sum, sub) => {
    if (sub.plan === FREE_PLAN) return sum;
    const plan = ROLE_PLANS[sub.role];
    if (!plan) return sum;
    return (
      sum +
      (sub.interval === "year" ? Math.round(plan.yearly / 12) : plan.monthly)
    );
  }, 0);
}

/**
 * Growth of a running total since an earlier count, as a whole percentage.
 * Zero when there was nothing to grow from — a percentage of nothing would
 * be infinite, and "+0%" is the honest reading of "no earlier figure".
 */
export function growthPercent(current: number, earlier: number) {
  if (earlier <= 0) return 0;
  return Math.round(((current - earlier) / earlier) * 100);
}
