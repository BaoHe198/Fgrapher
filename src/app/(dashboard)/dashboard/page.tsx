import {
  Bookmark,
  Calendar,
  ChevronRight,
  Images,
  MessageCircle,
  Package,
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
import { CATEGORIES_BY_ROLE } from "@/lib/constants";
import { features } from "@/lib/features";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  getCameraShopStats,
  getCostumeShopStats,
  getCustomerStats,
  getProviderStats,
  getRecentActivity,
  isProviderRoleSet,
  type CameraShopStats,
  type CostumeShopStats,
  type CustomerStats,
  type ProviderStats,
  type RecentActivityItem,
} from "@/services/dashboard";

import { AcceptingBookingsToggle } from "./accepting-bookings-toggle";
import { CheckoutSuccessToast } from "./checkout-success-toast";

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function greeting(firstName: string, t: Translator) {
  // The server's clock, not the visitor's: getHours() on Vercel is UTC, so
  // six in the evening in Vietnam greeted people with "good morning".
  // CLAUDE.md rule 10 — the product runs on Asia/Ho_Chi_Minh.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
  );
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return t(`greeting.${timeOfDay}`, { name: firstName });
}

const ACTIVITY_ICONS = {
  booking: Calendar,
  message: MessageCircle,
  review: Star,
  album: Images,
  order: Package,
} as const;

function activityText(
  item: RecentActivityItem,
  t: Translator,
  bookingStatusT: Translator,
  orderStatusT: Translator,
) {
  switch (item.type) {
    case "booking":
      return t("activityItems.booking", {
        status: bookingStatusT(`status.${item.status}`),
        name: item.personName ?? t("activityItems.fallbackPerson"),
      });
    case "message":
      return t("activityItems.message", {
        name: item.personName ?? t("activityItems.fallbackSender"),
      });
    case "review":
      return t("activityItems.review", {
        rating: item.rating,
        name: item.personName ?? t("activityItems.fallbackPerson"),
      });
    case "album":
      return t("activityItems.album", { title: item.albumTitle });
    case "order":
      return t("activityItems.order", {
        status: orderStatusT(`status.${item.status}`),
        name: item.personName ?? t("activityItems.fallbackPerson"),
      });
  }
}

interface StatCard {
  label: string;
  value: string;
  /** Where the number comes from. A count you can't open is a dead end. */
  href?: string;
}

function providerStatCards(stats: ProviderStats, t: Translator): StatCard[] {
  return [
    {
      label: t("stats.pendingRequests"),
      value: String(stats.pending),
      href: "/dashboard/bookings",
    },
    {
      label: t("stats.upcomingBookings"),
      value: String(stats.upcoming),
      href: "/dashboard/bookings",
    },
    {
      label: t("stats.earningsThisMonth"),
      value: formatCurrency(stats.earnings),
    },
    { label: t("stats.profileViews"), value: String(stats.views) },
  ];
}

// Where a costume shop's catalogue lives — see the sidebar entry.
const COSTUMES_HREF =
  "/dashboard/settings/profile?section=roleProfile#costumes";

function costumeShopStatCards(
  stats: CostumeShopStats,
  t: Translator,
): StatCard[] {
  return [
    {
      label: t("stats.messages"),
      value: String(stats.unreadMessages),
      href: "/dashboard/messages",
    },
    {
      label: t("stats.activeCostumes"),
      value: String(stats.activeCostumes),
      href: COSTUMES_HREF,
    },
    { label: t("stats.profileViews"), value: String(stats.views) },
  ];
}

function cameraShopStatCards(
  stats: CameraShopStats,
  t: Translator,
): StatCard[] {
  return [
    {
      label: t("stats.ordersToHandle"),
      value: String(stats.ordersToHandle),
      href: "/dashboard/shop-orders",
    },
    {
      label: t("stats.activeListings"),
      value: String(stats.activeListings),
      href: "/dashboard/listings",
    },
    {
      label: t("stats.messages"),
      value: String(stats.unreadMessages),
      href: "/dashboard/messages",
    },
    { label: t("stats.profileViews"), value: String(stats.views) },
  ];
}

function customerStatCards(stats: CustomerStats, t: Translator): StatCard[] {
  return [
    {
      label: t("stats.upcomingBookings"),
      value: String(stats.upcomingBookings),
      href: "/dashboard/bookings",
    },
    {
      label: t("stats.savedArtists"),
      value: String(stats.savedArtists),
      href: "/saved",
    },
    {
      label: t("stats.messages"),
      value: String(stats.messages),
      href: "/dashboard/messages",
    },
    // Hidden while MARKETPLACE_ENABLED=false.
    ...(features.marketplaceEnabled
      ? [
          {
            label: t("stats.orders"),
            value: String(stats.orders),
            href: "/dashboard/orders",
          },
        ]
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
    include: {
      profiles: true,
      roles: { select: { role: true, verificationStatus: true } },
    },
  });
  if (!user) {
    redirect("/login");
  }

  const [t, roleT, bookingStatusT, orderStatusT] = await Promise.all([
    getTranslations("dashboardCore.home"),
    getTranslations("role"),
    getTranslations("dashboardCore.bookings"),
    getTranslations("dashboardCore.shopOrders"),
  ]);

  // Not providers (neither takes bookings), not customers either. A camera
  // shop only has a shop to run while Chợ F is switched on.
  const isCostumeShop = !isProvider && roles.includes("COSTUME_SHOP");
  const isCameraShop =
    !isProvider &&
    !isCostumeShop &&
    features.marketplaceEnabled &&
    roles.includes("CAMERA_SHOP");

  const [activity, statCards] = await Promise.all([
    getRecentActivity(user.id, isProvider),
    isProvider
      ? getProviderStats(user.id).then((stats) => providerStatCards(stats, t))
      : isCostumeShop
        ? getCostumeShopStats(user.id).then((stats) =>
            costumeShopStatCards(stats, t),
          )
        : isCameraShop
          ? getCameraShopStats(user.id).then((stats) =>
              cameraShopStatCards(stats, t),
            )
          : getCustomerStats(user.id).then((stats) =>
              customerStatCards(stats, t),
            ),
  ]);

  // Prompt G2, VIỆC 6 — "Nêu rõ còn thiếu gì thay vì chỉ hiện phần trăm":
  // each entry is a translated label for one missing piece, not just a
  // percentage. A role with no Profile row at all counts as missing that
  // role's whole profile; a role WITH a Profile but no categories still
  // gets its own "chọn thể loại sở trường" line (previously invisible —
  // completion% never looked at Profile.categories at all).
  const missingItems: { label: string; href?: string }[] = [];
  const pushMissing = (label: string, href?: string) =>
    missingItems.push({ label, href });
  if (!user.avatar) pushMissing(t("completeProfile.missing.avatar"));
  if (!user.coverImage) pushMissing(t("completeProfile.missing.coverImage"));
  if (!user.phone) pushMissing(t("completeProfile.missing.phone"));
  // Identity verification gates the public profile and every request
  // (CLAUDE.md rule 5), yet a new provider's checklist never mentioned it —
  // they only met it as an unexplained empty "Yêu cầu phù hợp" (24/09 audit).
  for (const role of nonCustomerRoles) {
    const status = user.roles.find((r) => r.role === role)?.verificationStatus;
    if (status === "UNVERIFIED" || status === "REJECTED") {
      pushMissing(
        t("completeProfile.missing.verifyIdentity", { role: roleT(role) }),
        `/onboarding/verification?role=${role}`,
      );
    } else if (status === "PENDING") {
      pushMissing(
        t("completeProfile.missing.verifyPending", { role: roleT(role) }),
      );
    }
  }
  for (const role of nonCustomerRoles) {
    const profile = user.profiles.find((p) => p.role === role);
    if (!profile) {
      pushMissing(
        t("completeProfile.missing.roleProfile", { role: roleT(role) }),
      );
    } else if (
      profile.categories.length === 0 &&
      // A role with no category list (CAMERA_SHOP) can never satisfy this,
      // so the nudge used to sit on its dashboard permanently.
      (CATEGORIES_BY_ROLE[role]?.length ?? 0) > 0
    ) {
      pushMissing(
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
        <h1 className="text-heading-lg text-text-primary sm:text-display-md">
          {greeting(firstName, t)}
        </h1>
        {isProvider ? (
          <AcceptingBookingsToggle initialValue={user.acceptingBookings} />
        ) : null}
      </div>

      <div
        // Two up from the smallest screen: one card per row put four
        // numbers in ~500px on a phone, above anything to act on.
        className={`grid grid-cols-2 gap-3 sm:gap-4 ${
          statCards.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
        }`}
      >
        {statCards.map((stat) => {
          const card = (
            <Card
              interactive={Boolean(stat.href)}
              className="flex h-full flex-col gap-1.5 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(5)]"
            >
              <span className="text-body-sm text-text-secondary">
                {stat.label}
              </span>
              {/* nowrap + a step smaller on phones: break-words split
                  "2.500.000₫" before the ₫ in a half-width card. */}
              <span className="text-heading-md whitespace-nowrap text-text-primary tabular-nums sm:text-display-md">
                {stat.value}
              </span>
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              {card}
            </Link>
          ) : (
            <div key={stat.label}>{card}</div>
          );
        })}
      </div>

      {hasIncompleteProfile ? (
        <Card className="flex flex-col gap-3 border border-warning bg-warning-bg">
          <span className="text-body-md font-semibold! text-text-primary">
            {t("completeProfile.title")}
          </span>
          <ul className="flex flex-col gap-1.5">
            {missingItems.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 text-body-sm text-text-secondary"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                {item.href ? (
                  <Link
                    href={item.href}
                    className="font-semibold! text-text-link underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
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
            <p className="text-body-md font-semibold! text-text-primary">
              {t("noActivity")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  href={
                    isProvider
                      ? "/dashboard/portfolio"
                      : isCostumeShop
                        ? COSTUMES_HREF
                        : isCameraShop
                          ? "/dashboard/listings"
                          : "/browse"
                  }
                />
              }
            >
              {isProvider
                ? t("buildPortfolio")
                : isCostumeShop
                  ? t("manageCostumes")
                  : isCameraShop
                    ? t("manageListings")
                    : t("browseArtists")}
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
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-bg-sunken focus-visible:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-gold-500/40 focus-visible:outline-none focus-visible:ring-inset"
                >
                  <Icon className="size-4 shrink-0 text-text-tertiary" />
                  {/* Phones: the time goes under the text, so the text gets
                      the full width instead of wrapping beside it. */}
                  <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                    <span className="min-w-0 flex-1 text-body-md text-text-primary">
                      {activityText(item, t, bookingStatusT, orderStatusT)}
                    </span>
                    <span className="text-body-sm whitespace-nowrap text-text-tertiary">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-text-tertiary" />
                </Link>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
