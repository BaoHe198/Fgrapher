import { AlertTriangle, CreditCard, Flag, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getAdminStats, getRecentActivity } from "@/services/admin";

export const metadata = { title: "Admin overview — Fgrapher" };

export default async function AdminOverviewPage() {
  const [stats, activity] = await Promise.all([getAdminStats(), getRecentActivity()]);

  const metrics = [
    { label: "Total users", value: stats.totalUsers.toLocaleString(), sub: `${stats.userGrowthPercent >= 0 ? "+" : ""}${stats.userGrowthPercent}% vs last month` },
    { label: "Active subscriptions", value: stats.activeSubscriptions.toLocaleString(), sub: `${formatCurrency(stats.mrr, "USD")} MRR` },
    { label: "Bookings this month", value: stats.bookingsThisMonth.toLocaleString(), sub: `${stats.completionRate}% completion rate` },
    {
      label: "GMV this month",
      value: formatCurrency(stats.bookingGmvVnd + stats.orderGmvVnd),
      sub: `${formatCurrency(stats.bookingGmvVnd)} bookings · ${formatCurrency(stats.orderGmvVnd)} marketplace`,
    },
  ];

  const health = [
    { label: "Failed payments", value: stats.failedPayments, icon: CreditCard, href: "/admin/users" },
    { label: "Pending reports", value: stats.pendingReports, icon: Flag, href: "/admin/reports" },
    { label: "Subscriptions expiring in 7 days", value: stats.expiringSoon, icon: AlertTriangle, href: "/admin/users" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display-md text-text-primary">Overview</h1>

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
                <span className="text-heading-md text-text-primary">{h.value}</span>
                <span className="text-body-sm text-text-secondary">{h.label}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-heading-md text-text-primary">Recent activity</span>
        <Card padding={false}>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-text-secondary">No activity yet</p>
          ) : (
            activity.map((event) => (
              <div
                key={`${event.type}-${event.id}`}
                className="flex items-center justify-between border-b border-border-subtle px-5 py-3 last:border-b-0"
              >
                <span className="text-body-sm text-text-primary">{event.label}</span>
                <span className="text-body-sm text-text-tertiary">
                  {new Date(event.timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
