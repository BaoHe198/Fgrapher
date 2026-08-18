"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/account", label: "Account" },
  { href: "/dashboard/settings/roles", label: "Roles" },
  { href: "/dashboard/settings/billing", label: "Billing" },
  { href: "/dashboard/settings/notifications", label: "Notifications" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border-subtle">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-body-md font-semibold transition-colors duration-150",
              isActive
                ? "border-brand-primary text-text-primary"
                : "border-transparent text-text-secondary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
