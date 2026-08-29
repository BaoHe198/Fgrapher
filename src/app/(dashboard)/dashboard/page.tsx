import {
  Bookmark,
  Calendar,
  MessageCircle,
  ShoppingBag,
  Star,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function greeting(firstName: string, t: Translator) {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return t(`greeting.${timeOfDay}`, { name: firstName });
}

const ACTIVITY_ICONS = {
  booking: Calendar,
  message: MessageCircle,
  review: Star,
} as const;

function providerStatCards(stats: ProviderStats, t: Translator) {
  return [
    { label: t("stats.pendingRequests"), value: String(stats.pending) },
    { label: t("stats.confirmed"), value: String(stats.confirmed) },
    { label: t("stats.earnings"), value: formatCurrency(stats.earnings) },
    { label: t("stats.profileViews"), value: String(stats.views) },
  ];
}

function customerStatCards(stats: CustomerStats, t: Translator) {
  return [
    {
      label: t("stats.upcomingBookings"),
      value: String(stats.upcomingBookings),
    },
    { label: t("stats.savedArtists"), value: String(stats.savedArtists) },
    { label: t("stats.messages"), value: String(stats.messages) },
    // Hidden while MARKETPLACE_ENABLED=false.
    ...(features.marketplaceEnabled
      ? [{ label: t("stats.orders"), value: String(stats.orders) }]
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
  // ADMIN has no Profile row and no Subscription (see the schema comment
  // on Role.ADMIN) — including it here made every admin-only account see
  // a permanently-stuck "complete your profile" nudge.
  const nonCustomerRoles = roles.filter(
    (role) => role !== "CUSTOMER" && role !== "ADMIN",
  );

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { profiles: true },
  });
  if (!user) {
    redirect("/login");
  }

  const [t, roleT] = await Promise.all([
    getTranslations("dashboardCore.home"),
    getTranslations("role"),
  ]);

  const [activity, statCards] = await Promise.all([
    getRecentActivity(user.id, isProvider),
    isProvider
      ? getProviderStats(user.id).then((stats) => providerStatCards(stats, t))
      : getCustomerStats(user.id).then((stats) => customerStatCards(stats, t)),
  ]);

  // Prompt G2, VIỆC 6 — "Nêu rõ còn thiếu gì thay vì chỉ hiện phần trăm":
  // each entry is a translated label for one missing piece, not just a
  // percentage. A role with no Profile row at all counts as missing that
  // role's whole profile; a role WITH a Profile but no categories still
  // gets its own "chọn thể loại sở trường" line (previously invisible —
  // completion% never looked at Profile.categories at all).
  const missingItems: string[] = [];
  if (!user.avatar) missingItems.push(t("completeProfile.missing.avatar"));
  if (!user.coverImage)
    missingItems.push(t("completeProfile.missing.coverImage"));
  if (!user.bio) missingItems.push(t("completeProfile.missing.bio"));
  if (!user.phone) missingItems.push(t("completeProfile.missing.phone"));
  for (const role of nonCustomerRoles) {
    const profile = user.profiles.find((p) => p.role === role);
    if (!profile) {
      missingItems.push(
        t("completeProfile.missing.roleProfile", { role: roleT(role) }),
      );
    } else if (profile.categories.length === 0) {
      missingItems.push(
        t("completeProfile.missing.categories", { role: roleT(role) }),
      );
    }
  }

  const hasIncompleteProfile = missingItems.length > 0;

  const firstName =
    user.firstName ?? user.name?.split(" ")[0] ?? t("fallbackName");

  return (
    <div className="flex flex-col gap-6">
      {/* Subscription checkout redirect toast (?checkout=success) — not
          marketplace-related despite the filename; dormant while
          BILLING_ENABLED=false since that Checkout route itself 404s. */}
      {features.billingEnabled ? <CheckoutSuccessToast /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-display-md text-text-primary">
          {greeting(firstName, t)}
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
          <span className="text-body-md font-semibold text-text-primary">
            {t("completeProfile.title")}
          </span>
          <ul className="flex flex-col gap-1.5">
            {missingItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-body-sm text-text-secondary"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                {item}
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            nativeButton={false}
            render={<Link href="/dashboard/settings/profile" />}
          >
            {t("completeProfile.cta")}
          </Button>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionHead title={t("recentActivity")} />
        {activity.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            {isProvider ? (
              <ShoppingBag className="size-10 text-text-tertiary" />
            ) : (
              <Bookmark className="size-10 text-text-tertiary" />
            )}
            <p className="text-body-md font-semibold text-text-primary">
              {t("noActivity")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={
                <Link href={isProvider ? "/dashboard/portfolio" : "/browse"} />
              }
            >
              {isProvider ? t("buildPortfolio") : t("browseArtists")}
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
