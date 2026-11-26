import {
  AlertTriangle,
  BadgeCheck,
  ClipboardList,
  CreditCard,
  Flag,
  ImageIcon,
  MapPin,
  Repeat,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import {
  getAdminQueueCounts,
  getAdminStats,
  getRecentActivity,
} from "@/services/admin";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountFlows.admin.overview");
  return { title: t("metaTitle") };
}

export default async function AdminOverviewPage() {
  const [stats, t, activityT, queues, targetT, reasonT] = await Promise.all([
    getAdminStats(),
    getTranslations("accountFlows.admin.overview"),
    getTranslations("accountFlows.admin.overview.activity"),
    getAdminQueueCounts(),
    getTranslations("accountFlows.admin.reports.targetTypes"),
    getTranslations("sharedComponents.reportModal.reasons"),
  ]);
  const activity = await getRecentActivity(activityT, 15, {
    targetType: (code) => (targetT.has(code) ? targetT(code) : code),
    reason: (code) => (reasonT.has(code) ? reasonT(code) : code),
  });

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

  // The work waiting on an admin, first: a provider cannot go public until
  // the first two are done. They were only numbers in the sidebar, which a
  // phone keeps closed (role walk-through, 25/11/2026).
  const waiting = [
    {
      label: t("pendingVerifications"),
      value: queues.verifications,
      icon: BadgeCheck,
      href: "/admin/verifications",
    },
    {
      label: t("pendingMedia"),
      value: queues.moderation,
      icon: ImageIcon,
      href: "/admin/moderation",
    },
    {
      label: t("pendingReports"),
      value: queues.reports,
      icon: Flag,
      href: "/admin/reports",
    },
    {
      label: t("pendingServiceRequests"),
      value: queues.serviceRequests,
      icon: ClipboardList,
      href: "/admin/service-requests",
    },
    {
      label: t("pendingPlaces"),
      value: queues.places,
      icon: MapPin,
      href: "/admin/places",
    },
    {
      label: t("pendingRoleChanges"),
      value: queues.roleChangeRequests,
      icon: Repeat,
      href: "/admin/role-change-requests",
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
      label: t("expiringSoon"),
      value: stats.expiringSoon,
      icon: AlertTriangle,
      href: "/admin/users",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>

      <div className="flex flex-col gap-3">
        <span className="text-heading-md text-text-primary">
          {t("waitingTitle")}
        </span>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {waiting.map((w) => (
            <Link key={w.label} href={w.href}>
              <Card
                interactive
                className={cn(
                  "flex h-full flex-row items-center gap-3 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(5)]",
                  w.value > 0 && "border border-gold-400",
                )}
              >
                <w.icon
                  className={cn(
                    "size-5 shrink-0",
                    w.value > 0 ? "text-gold-600" : "text-text-tertiary",
                  )}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="text-heading-md text-text-primary tabular-nums">
                    {w.value}
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {w.label}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Two columns even on phones: one card per row made the overview
          four screens long. The value steps down a size there so an
          amount like "50.000.000₫" still fits half the width. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card
            key={m.label}
            className="flex flex-col gap-1 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(5)]"
          >
            <span className="text-body-sm text-text-tertiary">{m.label}</span>
            <span className="text-heading-md whitespace-nowrap text-text-primary tabular-nums sm:text-heading-lg">
              {m.value}
            </span>
            <span className="flex items-start gap-1 text-body-sm text-text-secondary">
              <TrendingUp className="mt-1 size-3.5 shrink-0" />
              {m.sub}
            </span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {health.map((h) => (
          <Link key={h.label} href={h.href}>
            <Card interactive className="flex flex-row items-center gap-3">
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
                className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 sm:px-5"
              >
                <span className="min-w-0 text-body-sm text-text-primary">
                  {event.label}
                </span>
                <span className="shrink-0 text-body-sm whitespace-nowrap text-text-tertiary">
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
