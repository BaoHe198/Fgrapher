import {
  Bookmark,
  Calendar,
  MessageCircle,
  ShoppingBag,
  Star,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  getCustomerStats,
  getProviderStats,
  getRecentActivity,
  isProviderRoleSet,
  type CustomerStats,
  type ProviderStats,
} from "@/services/dashboard";

import { AcceptingBookingsToggle } from "./accepting-bookings-toggle";
import { CheckoutSuccessToast } from "./checkout-success-toast";

function greeting(firstName: string) {
  const hour = new Date().getHours();
  const timeOfDay =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${timeOfDay}, ${firstName}`;
}

const ACTIVITY_ICONS = {
  booking: Calendar,
  message: MessageCircle,
  review: Star,
} as const;

function providerStatCards(stats: ProviderStats) {
  return [
    { label: "Pending requests", value: String(stats.pending) },
    { label: "Confirmed", value: String(stats.confirmed) },
    { label: "Earnings", value: formatCurrency(stats.earnings) },
    { label: "Profile views", value: String(stats.views) },
  ];
}

function customerStatCards(stats: CustomerStats) {
  return [
    { label: "Upcoming bookings", value: String(stats.upcomingBookings) },
    { label: "Saved artists", value: String(stats.savedArtists) },
    { label: "Messages", value: String(stats.messages) },
    // Hidden while MARKETPLACE_ENABLED=false.
    ...(features.marketplaceEnabled
      ? [{ label: "Orders", value: String(stats.orders) }]
      : []),
  ];
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const roles = session.user.roles;
  const isProvider = isProviderRoleSet(roles);
  const nonCustomerRoles = roles.filter((role) => role !== "CUSTOMER");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { profiles: true },
  });
  if (!user) {
    redirect("/login");
  }

  const [activity, statCards] = await Promise.all([
    getRecentActivity(user.id, isProvider),
    isProvider
      ? getProviderStats(user.id).then(providerStatCards)
      : getCustomerStats(user.id).then(customerStatCards),
  ]);

  const hasIncompleteProfile =
    nonCustomerRoles.length > 0 &&
    !nonCustomerRoles.every((role) =>
      user.profiles.some((profile) => profile.role === role),
    );

  const completionFields = [
    user.avatar,
    user.bio,
    user.phone,
    user.location,
    user.username,
  ];
  const completion = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100,
  );

  const firstName = user.firstName ?? user.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-6">
      {/* Subscription checkout redirect toast (?checkout=success) — not
          marketplace-related despite the filename; dormant while
          BILLING_ENABLED=false since that Checkout route itself 404s. */}
      {features.billingEnabled ? <CheckoutSuccessToast /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-display-md text-text-primary">
          {greeting(firstName)}
        </h1>
        {isProvider ? (
          <AcceptingBookingsToggle initialValue={user.acceptingBookings} />
        ) : null}
      </div>

      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          statCards.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
        }`}
      >
        {statCards.map((stat) => (
          <Card key={stat.label} className="flex flex-col gap-1.5">
            <span className="text-body-sm text-text-secondary">
              {stat.label}
            </span>
            <span className="text-display-md text-text-primary">
              {stat.value}
            </span>
          </Card>
        ))}
      </div>

      {hasIncompleteProfile ? (
        <Card className="flex flex-col gap-3 border border-warning bg-warning-bg">
          <div className="flex items-center justify-between">
            <span className="text-body-md font-semibold text-text-primary">
              Complete your profile
            </span>
            <span className="text-body-sm text-text-secondary">
              {completion}%
            </span>
          </div>
          <Progress value={completion} />
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            nativeButton={false}
            render={<Link href="/dashboard/settings/profile" />}
          >
            Complete your profile
          </Button>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionHead title="Recent activity" />
        {activity.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            {isProvider ? (
              <ShoppingBag className="size-10 text-text-tertiary" />
            ) : (
              <Bookmark className="size-10 text-text-tertiary" />
            )}
            <p className="text-body-md font-semibold text-text-primary">
              No activity yet
            </p>
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={
                <Link href={isProvider ? "/dashboard/portfolio" : "/browse"} />
              }
            >
              {isProvider ? "Build your portfolio" : "Browse artists"}
            </Button>
          </Card>
        ) : (
          <Card
            padding={false}
            className="flex flex-col divide-y divide-border-subtle"
          >
            {activity.map((item) => {
              const Icon = ACTIVITY_ICONS[item.type];
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <Icon className="size-4 shrink-0 text-text-tertiary" />
                  <span className="flex-1 text-body-md text-text-primary">
                    {item.text}
                  </span>
                  <span className="text-body-sm text-text-tertiary">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
