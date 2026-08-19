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
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
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
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { useUserRoles } from "@/hooks/use-user-roles";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function DashboardSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { roles, canUpload, canSell, canReceiveBookings, isCustomerOnly } = useUserRoles();
  const unreadMessages = useUnreadMessages();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    {
      href: "/dashboard/bookings",
      label: isCustomerOnly ? "My bookings" : "Bookings",
      icon: Calendar,
    },
    ...(canReceiveBookings
      ? [{ href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays }]
      : []),
    ...(canUpload
      ? [{ href: "/dashboard/portfolio", label: "Portfolio", icon: ImageIcon }]
      : []),
    ...(canSell
      ? [
          { href: "/dashboard/listings", label: "Listings", icon: ShoppingBag },
          { href: "/dashboard/shop-orders", label: "Shop orders", icon: Package },
        ]
      : []),
    { href: "/dashboard/orders", label: "My orders", icon: Package },
    { href: "/saved", label: "Saved", icon: Bookmark },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle, badge: unreadMessages },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  const nonCustomerRole = roles.find((role) => role !== "CUSTOMER");
  const planName = nonCustomerRole
    ? `Pro — ${ROLE_LABELS[nonCustomerRole]}`
    : "Free — Customer";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {items.map(({ href, label, icon: Icon, badge }) => {
        const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
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

      <div className="mt-3.5 flex flex-col gap-2 rounded-[var(--fg-radius-md)] bg-green-900 p-3.5">
        <span className="text-body-sm text-green-200">Current plan</span>
        <span className="text-heading-sm text-gold-50">{planName}</span>
        <Button
          variant="accent"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/settings/billing" />}
        >
          Manage plan
        </Button>
      </div>
    </div>
  );
}

export function MobileDashboardSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="secondary" size="icon">
            <Menu className="size-5" />
            <span className="sr-only">Open dashboard menu</span>
          </Button>
        }
      />
      <SheetContent side="left" className="w-3/4 sm:max-w-xs">
        <SheetHeader className="sr-only">
          <SheetTitle>Dashboard menu</SheetTitle>
          <SheetDescription>Dashboard navigation</SheetDescription>
        </SheetHeader>
        <div className="p-4" onClick={() => setOpen(false)}>
          <DashboardSidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
