"use client";

import {
  Bookmark,
  Calendar,
  CalendarDays,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Package,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMessaging } from "@/components/providers/messaging-provider";
import { useUserRoles } from "@/hooks/use-user-roles";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function DashboardSidebar({
  className,
  marketplaceEnabled,
}: {
  className?: string;
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("sharedComponents.dashboardSidebar");
  const roleT = useTranslations("role");
  const pathname = usePathname();
  const {
    roles,
    canUpload,
    canSell,
    canReceiveBookings,
    isCustomerOnly,
    hasRole,
  } = useUserRoles();
  const isAdmin = hasRole("ADMIN");
  const unreadMessages = useMessaging().unreadCount;

  const items: NavItem[] = [
    { href: "/dashboard", label: t("overview"), icon: LayoutDashboard },
    {
      href: "/dashboard/bookings",
      label: isCustomerOnly ? t("myBookings") : t("bookings"),
      icon: Calendar,
    },
    ...(canReceiveBookings
      ? [
          {
            href: "/dashboard/calendar",
            label: t("calendar"),
            icon: CalendarDays,
          },
          { href: "/dashboard/reviews", label: t("reviews"), icon: Star },
        ]
      : []),
    ...(canUpload
      ? [
          {
            href: "/dashboard/portfolio",
            label: t("portfolio"),
            icon: ImageIcon,
          },
        ]
      : []),
    ...(marketplaceEnabled && canSell
      ? [
          {
            href: "/dashboard/listings",
            label: t("listings"),
            icon: ShoppingBag,
          },
          {
            href: "/dashboard/shop-orders",
            label: t("shopOrders"),
            icon: Package,
          },
        ]
      : []),
    ...(marketplaceEnabled
      ? [{ href: "/dashboard/orders", label: t("myOrders"), icon: Package }]
      : []),
    { href: "/saved", label: t("saved"), icon: Bookmark },
    {
      href: "/dashboard/messages",
      label: t("messages"),
      icon: MessageCircle,
      badge: unreadMessages,
    },
    { href: "/dashboard/settings", label: t("settings"), icon: Settings },
    ...(isAdmin ? [{ href: "/admin", label: t("admin"), icon: Shield }] : []),
  ];

  // ADMIN is never "the plan" — admins have no Subscription (see the
  // schema comment on Role.ADMIN) and this card has nothing useful to
  // show them, so it's hidden entirely rather than picking ADMIN as the
  // displayed role.
  const nonCustomerRole = roles.find(
    (role) => role !== "CUSTOMER" && role !== "ADMIN",
  );
  const planName = nonCustomerRole
    ? t("planPro", { role: roleT(nonCustomerRole) })
    : t("planFree");

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {items.map(({ href, label, icon: Icon, badge }) => {
        const isActive =
          href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-[var(--fg-radius-sm)] px-3 py-2.5 text-body-md font-semibold transition-colors duration-150",
              isActive
                ? "bg-success-bg text-brand-primary"
                : "text-text-secondary hover:bg-bg-sunken",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
            {badge ? (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 text-xs font-bold text-text-on-brand">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}

      {isAdmin ? null : (
        <div className="mt-3.5 flex flex-col gap-2 rounded-[var(--fg-radius-md)] bg-green-900 p-3.5">
          <span className="text-body-sm text-green-200">
            {t("currentPlan")}
          </span>
          <span className="text-heading-sm text-gold-50">{planName}</span>
          <Button
            variant="accent"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/settings/billing" />}
          >
            {t("managePlan")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function MobileDashboardSidebar({
  marketplaceEnabled,
}: {
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("sharedComponents.dashboardSidebar");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="secondary" size="icon">
            <Menu className="size-5" />
            <span className="sr-only">{t("openMenu")}</span>
          </Button>
        }
      />
      <SheetContent side="left" className="w-3/4 sm:max-w-xs">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("menuTitle")}</SheetTitle>
          <SheetDescription>{t("menuDescription")}</SheetDescription>
        </SheetHeader>
        <div className="p-4" onClick={() => setOpen(false)}>
          <DashboardSidebar marketplaceEnabled={marketplaceEnabled} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
