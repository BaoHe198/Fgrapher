"use client";

import {
  ArrowLeftRight,
  BadgeCheck,
  Flag,
  Handshake,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Users,
  Wallet,
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
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", key: "overview", icon: LayoutDashboard },
  { href: "/admin/users", key: "users", icon: Users },
  { href: "/admin/reports", key: "reports", icon: Flag },
  { href: "/admin/verifications", key: "verifications", icon: BadgeCheck },
  {
    href: "/admin/role-change-requests",
    key: "roleChangeRequests",
    icon: ArrowLeftRight,
  },
  { href: "/admin/payments", key: "payments", icon: Wallet },
  { href: "/admin/moderation", key: "moderation", icon: ImageIcon },
  { href: "/admin/compliance", key: "compliance", icon: ShieldCheck },
  {
    href: "/admin/service-requests",
    key: "serviceRequests",
    icon: Handshake,
  },
] as const;

export function AdminSidebar() {
  const t = useTranslations("accountFlows.admin.sidebar");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const isActive =
          href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-[var(--fg-radius-sm)] px-3 py-2.5 text-body-md font-semibold! transition-colors duration-150",
              isActive
                ? "bg-surface-card text-text-primary"
                : "text-text-secondary hover:bg-surface-card/60",
            )}
          >
            <Icon className="size-[18px]" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

// Same Sheet-based drawer pattern as MobileDashboardSidebar
// (src/components/layout/dashboard-sidebar.tsx) — the admin section had
// no mobile navigation at all below lg (aside is hidden, no trigger of
// any kind), leaving every /admin/* page below 1024px with no way to
// move between sections.
export function MobileAdminSidebar() {
  const t = useTranslations("accountFlows.admin.sidebar");
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
          <AdminSidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
