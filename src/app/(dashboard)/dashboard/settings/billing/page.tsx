import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { rolePricesVnd } from "@/lib/constants/plans";
import { features } from "@/lib/features";
import { getBillingOverview } from "@/services/subscription";

import { BillingSettingsContent } from "./billing-settings-content";
import { LocalPaymentsContent } from "./local-payments-content";

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const localPaymentsEnabled =
    features.momoEnabled ||
    features.zalopayEnabled ||
    features.bankTransferEnabled;

  // Dormant while BILLING_ENABLED=false — see CLAUDE.md. Falls through to
  // the local-rail picker below whenever at least one of those is on;
  // only shows this flat message when every payment method is off.
  if (!features.billingEnabled && !localPaymentsEnabled) {
    const t = await getTranslations("dashboardSettings.billing");
    return (
      <div className="rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card p-8 text-center">
        <h1 className="text-heading-lg text-text-primary">
          {t("disabledTitle")}
        </h1>
        <p className="mt-2 text-body-md text-text-secondary">
          {t("disabledBody")}
        </p>
      </div>
    );
  }

  const userRoles = await getBillingOverview(session.user.id);

  if (!features.billingEnabled) {
    return (
      <LocalPaymentsContent
        roles={userRoles.map((ur) => ({
          role: ur.role,
          active: ur.active,
          subscription: ur.subscription
            ? {
                status: ur.subscription.status,
                currentPeriodEnd:
                  ur.subscription.currentPeriodEnd?.toISOString() ?? null,
              }
            : null,
        }))}
        monthlyPrices={rolePricesVnd("month")}
        yearlyPrices={rolePricesVnd("year")}
        momoEnabled={features.momoEnabled}
        zalopayEnabled={features.zalopayEnabled}
        bankTransferEnabled={features.bankTransferEnabled}
      />
    );
  }

  return (
    <BillingSettingsContent
      roles={userRoles.map((ur) => ({
        role: ur.role,
        active: ur.active,
        subscription: ur.subscription
          ? {
              status: ur.subscription.status,
              currentPeriodEnd:
                ur.subscription.currentPeriodEnd?.toISOString() ?? null,
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
