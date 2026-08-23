import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { rolePricesVnd } from "@/lib/constants/plans";
import { features } from "@/lib/features";
import { getBillingOverview } from "@/services/subscription";

import { BillingSettingsContent } from "./billing-settings-content";

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Dormant while BILLING_ENABLED=false — see CLAUDE.md. Show a plain
  // message instead of Stripe-backed billing UI (plan/cancel/portal
  // buttons that would just 404 against the disabled /api/stripe/*
  // routes).
  if (!features.billingEnabled) {
    return (
      <div className="rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card p-8 text-center">
        <h1 className="text-heading-lg text-text-primary">
          Hiện tại Fgrapher đang miễn phí cho toàn bộ nhà cung cấp dịch vụ
        </h1>
        <p className="mt-2 text-body-md text-text-secondary">
          Chúng tôi sẽ thông báo trước ít nhất 30 ngày trước khi bắt đầu thu
          phí. Không cần làm gì thêm ở trang này.
        </p>
      </div>
    );
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
