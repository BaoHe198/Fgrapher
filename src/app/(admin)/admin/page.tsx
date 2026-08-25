import { AlertTriangle, CreditCard, Flag, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import { getAdminStats, getRecentActivity } from "@/services/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountFlows.admin.overview");
  return { title: t("metaTitle") };
}

export default async function AdminOverviewPage() {
  const [stats, t, activityT] = await Promise.all([
    getAdminStats(),
    getTranslations("accountFlows.admin.overview"),
    getTranslations("accountFlows.admin.overview.activity"),
  ]);
  const activity = await getRecentActivity(activityT);

  const metrics = [
    {
      label: t("totalUsers"),
      value: formatNumber(stats.totalUsers),
      sub: t("totalUsersSub", {
        sign: stats.userGrowthPercent >= 0 ? "+" : "",
        percent: stats.userGrowthPercent,
      }),
    },
    {
      label: t("activeSubscriptions"),
      value: formatNumber(stats.activeSubscriptions),
      sub: t("activeSubscriptionsSub", {
        mrr: formatCurrency(stats.mrr, "VND"),
      }),
    },
    {
      label: t("bookingsThisMonth"),
      value: formatNumber(stats.bookingsThisMonth),
      sub: t("bookingsThisMonthSub", { rate: stats.completionRate }),
    },
    {
      label: t("gmvThisMonth"),
      value: formatCurrency(stats.bookingGmvVnd + stats.orderGmvVnd),
      sub: t("gmvThisMonthSub", {
        bookingGmv: formatCurrency(stats.bookingGmvVnd),
        orderGmv: formatCurrency(stats.orderGmvVnd),
      }),
    },
  ];

  const health = [
    {
      label: t("failedPayments"),
      value: stats.failedPayments,
      icon: CreditCard,
      href: "/admin/users",
    },
    {
      label: t("pendingReports"),
      value: stats.pendingReports,
      icon: Flag,
      href: "/admin/reports",
    },
    {
      label: t("expiringSoon"),
      value: stats.expiringSoon,
      icon: AlertTriangle,
      href: "/admin/users",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="flex flex-col gap-1">
            <span className="text-body-sm text-text-tertiary">{m.label}</span>
            <span className="text-heading-lg text-text-primary">{m.value}</span>
            <span className="flex items-center gap-1 text-body-sm text-text-secondary">
              <TrendingUp className="size-3.5" />
              {m.sub}
            </span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {health.map((h) => (
          <Link key={h.label} href={h.href}>
            <Card className="flex items-center gap-3">
              <h.icon className="size-5 text-text-tertiary" />
              <div className="flex flex-col">
                <span className="text-heading-md text-text-primary">
                  {h.value}
                </span>
                <span className="text-body-sm text-text-secondary">
                  {h.label}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-heading-md text-text-primary">
          {t("recentActivity")}
        </span>
        <Card padding={false}>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-text-secondary">
              {t("noActivity")}
            </p>
          ) : (
            activity.map((event) => (
              <div
                key={`${event.type}-${event.id}`}
                className="flex items-center justify-between border-b border-border-subtle px-5 py-3 last:border-b-0"
              >
                <span className="text-body-sm text-text-primary">
                  {event.label}
                </span>
                <span className="text-body-sm text-text-tertiary">
                  {formatDateTime(event.timestamp)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
