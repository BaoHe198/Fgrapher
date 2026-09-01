"use client";

import {
  ArrowLeftRight,
  BadgeCheck,
  Flag,
  Handshake,
  Image as ImageIcon,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
