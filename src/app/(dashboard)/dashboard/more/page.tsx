import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NAV_ICON_COMPONENTS } from "@/components/layout/nav-icons";
import { auth } from "@/lib/auth";
import { moreGroups } from "@/lib/dashboard-nav";
import { features } from "@/lib/features";

export async function generateMetadata() {
  const t = await getTranslations("dashboardCore.more");
  return { title: t("metaTitle") };
}

/**
 * "Tiện ích khác": what a provider does besides their own job — selling and
 * buying on Chợ F, booking other people, posting a request, saved artists.
 * Kept off the main menu so the job itself is what the menu shows (project
 * owner, 20/11/2026).
 */
export default async function MorePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getTranslations("dashboardCore.more");
  const tItems = await getTranslations("sharedComponents.dashboardNav.items");
  const groups = moreGroups({
    roles: session.user.roles,
    marketplaceEnabled: features.marketplaceEnabled,
  });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">{t("lede")}</p>
      </div>
      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`more-${group.key}`}
          className="flex flex-col gap-2"
        >
          <h2
            id={`more-${group.key}`}
            className="text-caption-upper tracking-[0.12em] text-text-tertiary"
          >
            {t(`groups.${group.key}`)}
          </h2>
          <ul className="overflow-hidden rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card">
            {group.items.map((item) => {
              const Icon = NAV_ICON_COMPONENTS[item.icon];
              return (
                <li
                  key={item.key}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  <Link
                    href={item.href}
                    className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
                  >
                    <Icon
                      aria-hidden
                      className="size-5 shrink-0 text-text-secondary"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body-md font-semibold! text-text-primary">
                        {tItems(item.label)}
                      </span>
                      <span className="text-body-sm text-text-secondary">
                        {t(`hints.${item.key}`)}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-text-tertiary"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
