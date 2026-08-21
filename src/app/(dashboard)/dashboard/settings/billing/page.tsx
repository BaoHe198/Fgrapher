import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { rolePricesVnd } from "@/lib/constants/plans";
import { getBillingOverview } from "@/services/subscription";

import { BillingSettingsContent } from "./billing-settings-content";

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userRoles = await getBillingOverview(session.user.id);

  return (
    <BillingSettingsContent
      roles={userRoles.map((ur) => ({
        role: ur.role,
        active: ur.active,
        subscription: ur.subscription
          ? {
              status: ur.subscription.status,
              currentPeriodEnd: ur.subscription.currentPeriodEnd?.toISOString() ?? null,
              cancelAtPeriodEnd: ur.subscription.cancelAtPeriodEnd,
              graceEndsAt: ur.subscription.graceEndsAt?.toISOString() ?? null,
              interval: ur.subscription.interval === "year" ? "year" : "month",
            }
          : null,
      }))}
      monthlyPrices={rolePricesVnd("month")}
      yearlyPrices={rolePricesVnd("year")}
    />
  );
}
