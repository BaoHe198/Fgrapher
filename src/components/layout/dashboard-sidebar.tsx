"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_ICON_COMPONENTS } from "@/components/layout/nav-icons";
import { useMessaging } from "@/components/providers/messaging-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  dashboardNav,
  isNavItemActive,
  type DashboardNavItem,
} from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

const NAV_ICONS = NAV_ICON_COMPONENTS;

function useNav(marketplaceEnabled: boolean) {
  const { roles } = useUserRoles();
  return dashboardNav({ roles, marketplaceEnabled });
}

function NavLink({
  item,
  pathname,
  unread,
  onNavigate,
}: {
  item: DashboardNavItem;
  pathname: string;
  unread: number;
  onNavigate?: () => void;
}) {
  const t = useTranslations("sharedComponents.dashboardNav.items");
  const Icon = NAV_ICONS[item.icon];
  const active = isNavItemActive(item, pathname);
  const badge = item.badge === "messages" ? unread : 0;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-[var(--fg-radius-sm)] px-3 py-2.5 text-body-md font-semibold! transition-colors duration-150",
        active
          ? "bg-success-bg text-brand-primary"
          : "text-text-secondary hover:bg-bg-sunken",
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1">{t(item.label)}</span>
      {badge ? (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 text-sm font-bold text-text-on-brand">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The desktop menu: the job itself first, then one line for everything
 * else and one for settings. See lib/dashboard-nav.ts for who sees what.
 */
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
  const { roles } = useUserRoles();
  const unread = useMessaging().unreadCount;
  const nav = useNav(marketplaceEnabled);

  const providerRole = roles.find(
    (role) => role !== "CUSTOMER" && role !== "ADMIN",
  );

  return (
    // A nav landmark, so screen readers (and the route-crawl spec) find the
    // dashboard menu the way they find the site header's.
    <nav
      aria-label={t("menuTitle")}
      className={cn("flex flex-col gap-1", className)}
    >
      {nav.primary.map((item) => (
        <NavLink
          key={item.key}
          item={item}
          pathname={pathname}
          unread={unread}
        />
      ))}
      <div aria-hidden className="my-2 h-px bg-border-subtle" />
      {nav.secondary.map((item) => (
        <NavLink
          key={item.key}
          item={item}
          pathname={pathname}
          unread={unread}
        />
      ))}

      {/* Only for someone with a provider role: a customer has no plan
          (CUSTOMER is free and stays free) and an admin has no
          Subscription. */}
      {providerRole && !roles.includes("ADMIN") ? (
        <div className="mt-3.5 flex flex-col gap-2 rounded-[var(--fg-radius-md)] bg-green-900 p-3.5">
          <span className="text-body-sm text-green-200">
            {t("currentPlan")}
          </span>
          <span className="text-heading-sm text-gold-50">
            {t("planPro", { role: roleT(providerRole) })}
          </span>
          <Button
            variant="accent"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/settings/billing" />}
          >
            {t("managePlan")}
          </Button>
        </div>
      ) : null}
    </nav>
  );
}

/**
 * The phone menu: a bar along the bottom edge, where the thumb is, with the
 * job's four main places one tap away and "Thêm" for the rest. It replaced
 * a "Menu bảng điều khiển" button that opened a side panel — two taps for
 * every move, and on an iPhone the panel's lower half could not be reached
 * (owner's screenshot, 20/11/2026).
 */
export function DashboardTabBar({
  marketplaceEnabled,
}: {
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("sharedComponents.dashboardNav");
  const tItems = useTranslations("sharedComponents.dashboardNav.items");
  const pathname = usePathname();
  const unread = useMessaging().unreadCount;
  const nav = useNav(marketplaceEnabled);
  const [open, setOpen] = useState(false);

  // Lets fixed things elsewhere (toasts, a page's floating button) sit
  // above the bar: see --fg-bottom-bar in globals.css.
  useEffect(() => {
    document.documentElement.classList.add("has-bottom-bar");
    return () => document.documentElement.classList.remove("has-bottom-bar");
  }, []);

  const tabs = nav.tabs.slice(0, -1);
  const moreActive =
    open || nav.sheet.some((item) => isNavItemActive(item, pathname));

  return (
    <>
      <nav
        aria-label={t("tabBarLabel")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = isNavItemActive(item, pathname);
            const badge = item.badge === "messages" ? unread : 0;
            return (
              <li key={item.key} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus relative flex h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight font-semibold",
                    active ? "text-brand-primary" : "text-text-tertiary",
                  )}
                >
                  <span className="relative">
                    <Icon
                      aria-hidden
                      className="size-[22px]"
                      strokeWidth={active ? 2.4 : 1.9}
                    />
                    {badge ? (
                      <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                        <span className="sr-only">{t("unread")} </span>
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="w-full truncate text-center">
                    {tItems(item.tabLabel ?? item.label)}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className={cn(
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight font-semibold",
                moreActive ? "text-brand-primary" : "text-text-tertiary",
              )}
            >
              <MoreHorizontal aria-hidden className="size-[22px]" />
              <span>{t("moreTab")}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="gap-0 lg:hidden">
          <SheetHeader className="pr-14">
            <SheetTitle>{t("moreTitle")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("moreDescription")}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-col gap-1">
              {nav.sheet.map((item) => (
                <NavLink
                  key={item.key}
                  item={item}
                  pathname={pathname}
                  unread={unread}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
