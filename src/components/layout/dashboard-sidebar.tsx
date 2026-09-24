"use client";

import {
  Bookmark,
  Calendar,
  CalendarDays,
  Handshake,
  Image as ImageIcon,
  LayoutDashboard,
  MessageCircle,
  Package,
  PanelLeft,
  Plus,
  Send,
  Settings,
  Shield,
  Shirt,
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

interface NavSection {
  /** Shown for provider roles only — see isProviderNav. */
  heading?: string;
  items: NavItem[];
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
  const { roles, canUpload, canSell, canReceiveBookings, hasRole } =
    useUserRoles();
  const isAdmin = hasRole("ADMIN");
  const unreadMessages = useMessaging().unreadCount;

  // Grouped by what the person is doing, for provider roles. As one flat
  // list a photographer got fifteen entries — their own work, their public
  // profile, their Chợ F shop and the things they hire other people for,
  // interleaved — and had to read every line to find one. A customer has
  // about eight and no second hat to separate, so theirs stays one list
  // without headings.
  const isProviderNav =
    canReceiveBookings || canUpload || canSell || hasRole("COSTUME_SHOP");

  const bookingsItem: NavItem = {
    href: "/dashboard/bookings",
    label: canReceiveBookings ? t("bookings") : t("myBookings"),
    icon: Calendar,
  };
  const myOrdersItem: NavItem[] = marketplaceEnabled
    ? [{ href: "/dashboard/orders", label: t("myOrders"), icon: Package }]
    : [];

  const sections: NavSection[] = [
    {
      items: [
        { href: "/dashboard", label: t("overview"), icon: LayoutDashboard },
        {
          href: "/dashboard/messages",
          label: t("messages"),
          icon: MessageCircle,
          badge: unreadMessages,
        },
      ],
    },
    {
      heading: t("sectionWork"),
      items: canReceiveBookings
        ? [
            bookingsItem,
            {
              href: "/dashboard/calendar",
              label: t("calendar"),
              icon: CalendarDays,
            },
            {
              href: "/dashboard/opportunities",
              label: t("opportunities"),
              icon: Handshake,
            },
            {
              href: "/dashboard/my-offers",
              label: t("myOffers"),
              icon: Handshake,
            },
          ]
        : [],
    },
    {
      heading: t("sectionProfile"),
      items: [
        ...(canUpload
          ? [
              {
                href: "/dashboard/portfolio",
                label: t("portfolio"),
                icon: ImageIcon,
              },
            ]
          : []),
        ...(canReceiveBookings
          ? [{ href: "/dashboard/reviews", label: t("reviews"), icon: Star }]
          : []),
        // A costume shop rents out outfits through chat, so it has no Chợ F
        // listings page — its catalogue lives in Settings → Profile. That is
        // the right architecture (CLAUDE.md, 22/09/2026) but it had no
        // visible way in, and /dashboard/listings told the role it could not
        // sell, so it read as "this role cannot post anything" (QA-06).
        ...(hasRole("COSTUME_SHOP")
          ? [
              {
                href: "/dashboard/settings/profile?section=roleProfile#costumes",
                label: t("costumes"),
                icon: Shirt,
              },
            ]
          : []),
      ],
    },
    {
      heading: t("sectionMarket"),
      items:
        marketplaceEnabled && canSell
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
              ...myOrdersItem,
            ]
          : [],
    },
    {
      heading: t("sectionHiring"),
      items: [
        // Someone who only books others: their bookings list is the heart
        // of this section rather than of "Work".
        ...(canReceiveBookings ? [] : [bookingsItem]),
        { href: "/requests/new", label: t("createBooking"), icon: Plus },
        { href: "/dashboard/requests", label: t("myRequests"), icon: Send },
        ...(marketplaceEnabled && canSell ? [] : myOrdersItem),
        { href: "/saved", label: t("saved"), icon: Bookmark },
      ],
    },
    {
      items: [
        { href: "/dashboard/settings", label: t("settings"), icon: Settings },
        ...(isAdmin
          ? [{ href: "/admin", label: t("admin"), icon: Shield }]
          : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

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
    // A nav landmark, so screen readers (and the route-crawl spec) find the
    // dashboard menu the way they find the site header's.
    <nav
      aria-label={t("menuTitle")}
      className={cn("flex flex-col gap-1", className)}
    >
      {sections.map((section, index) => (
        <div
          key={section.heading ?? `section-${index}`}
          role={section.heading ? "group" : undefined}
          aria-label={section.heading}
          className={cn("flex flex-col gap-1", index > 0 && "mt-3")}
        >
          {isProviderNav && section.heading ? (
            <span className="px-3 pb-1 text-caption-upper tracking-[0.08em] text-text-tertiary">
              {section.heading}
            </span>
          ) : null}
          {section.items.map(({ href, label, icon: Icon, badge }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--fg-radius-sm)] px-3 py-2.5 text-body-md font-semibold! transition-colors duration-150",
                  isActive
                    ? "bg-success-bg text-brand-primary"
                    : "text-text-secondary hover:bg-bg-sunken",
                )}
              >
                <Icon className="size-[18px]" />
                {label}
                {badge ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 text-sm font-bold text-text-on-brand">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Only for someone with a provider role. A customer has no plan —
          CUSTOMER is free and stays free — so the card used to spend the
          sidebar's most prominent slot on "Free — Customer" and a "Manage
          plan" button leading to a billing page with nothing on it for
          them. Admins are excluded for the reason given above. */}
      {isAdmin || !nonCustomerRole ? null : (
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
    </nav>
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
      {/* QA: this trigger and WebNav's site-wide nav trigger both render
          on every dashboard page and previously used the identical Menu
          (≡) icon — indistinguishable at a glance, despite opening two
          different navigation sets (this one: dashboard sections, left;
          WebNav's: site-wide links, right). PanelLeft reads as "open the
          side panel", matching what this one specifically does. */}
      <SheetTrigger
        render={
          // Labelled, not icon-only: a bare panel icon under the site
          // nav's ☰ read as a second, unexplained menu (24/09 audit).
          <Button variant="secondary" size="sm" aria-label={t("openMenu")}>
            <PanelLeft className="size-4" />
            {t("menuTitle")}
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
