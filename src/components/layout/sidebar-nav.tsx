"use client";

import type { Role } from "@prisma/client";
import {
  Briefcase,
  CalendarCheck,
  IdCard,
  LayoutDashboard,
  MessageSquare,
  Package,
  Rss,
  Search,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PROVIDER_ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const COMMON_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/search", label: "Search", icon: Search },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PROVIDER_LINKS: NavLink[] = [
  { href: "/profile", label: "My Profile", icon: IdCard },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/services", label: "Services", icon: Briefcase },
];

const CAMERA_SHOP_LINKS: NavLink[] = [
  { href: "/products", label: "Products", icon: Package },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
];

function NavGroup({ links, pathname }: { links: NavLink[]; pathname: string }) {
  return (
    <div className="space-y-0.5">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive &&
                "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

interface SidebarNavProps {
  roles: Role[];
}

export function SidebarNav({ roles }: SidebarNavProps) {
  const pathname = usePathname();
  const hasProviderRole = roles.some((role) => PROVIDER_ROLES.includes(role));
  const hasCameraShop = roles.includes("CAMERA_SHOP");

  return (
    <nav className="flex flex-col gap-4">
      <NavGroup links={COMMON_LINKS} pathname={pathname} />

      {hasProviderRole ? (
        <div className="space-y-1.5">
          <p className="px-2.5 text-xs font-medium text-muted-foreground/70">
            Provider
          </p>
          <NavGroup links={PROVIDER_LINKS} pathname={pathname} />
        </div>
      ) : null}

      {hasCameraShop ? (
        <div className="space-y-1.5">
          <p className="px-2.5 text-xs font-medium text-muted-foreground/70">
            Shop
          </p>
          <NavGroup links={CAMERA_SHOP_LINKS} pathname={pathname} />
        </div>
      ) : null}
    </nav>
  );
}
