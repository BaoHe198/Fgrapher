"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/settings/profile", key: "profile" },
  { href: "/dashboard/settings/account", key: "account" },
  { href: "/dashboard/settings/roles", key: "roles" },
  { href: "/dashboard/settings/billing", key: "billing" },
  { href: "/dashboard/settings/notifications", key: "notifications" },
  { href: "/dashboard/settings/data", key: "data" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("dashboardSettings.nav");

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border-subtle">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 border-b-2 px-4 py-3 text-body-md font-semibold! transition-colors duration-150",
              isActive
                ? "border-brand-primary text-text-primary"
                : "border-transparent text-text-secondary",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
