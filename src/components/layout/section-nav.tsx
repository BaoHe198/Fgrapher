"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useUserRoles } from "@/hooks/use-user-roles";
import { isSectionTabActive, sectionTabs } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

/**
 * Tabs across the top of a page that belongs to a section with several
 * pages ("Trang của tôi", "Tìm việc", a shop's "Cửa hàng"), so moving
 * between them is one tap. Scrolls sideways on a narrow phone rather than
 * wrapping onto a second row.
 */
export function SectionNav({
  marketplaceEnabled,
}: {
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("sharedComponents.dashboardNav.sections");
  const pathname = usePathname();
  const { roles } = useUserRoles();
  const section = sectionTabs(pathname, { roles, marketplaceEnabled });
  const scroller = useRef<HTMLElement>(null);

  // On a phone the strip is wider than the screen; bring the current tab
  // into view rather than leaving it cut off at the edge ("Thông tin" on
  // the details page was half off-screen).
  useEffect(() => {
    const nav = scroller.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const left = active.offsetLeft - nav.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < nav.scrollLeft || right > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = Math.max(0, left - 16);
    }
  }, [pathname]);

  if (!section) return null;

  return (
    <nav
      ref={scroller}
      aria-label={t(section.label)}
      className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-1 border-b border-border-subtle">
        {section.tabs.map((tab) => {
          const active = isSectionTabActive(tab, pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-center border-b-2 px-3 text-body-sm font-semibold! whitespace-nowrap transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
                  active
                    ? "border-brand-primary text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {t(`tabs.${tab.label}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
