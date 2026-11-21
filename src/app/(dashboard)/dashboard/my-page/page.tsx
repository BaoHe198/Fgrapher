import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  type LucideIcon,
  MapPin,
  MapPinned,
  Package,
  QrCode,
  ScrollText,
  Shirt,
  Star,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getMyPageStatus, type MyPageCard } from "@/services/my-page";

export async function generateMetadata() {
  const t = await getTranslations("dashboardCore.myPage");
  return { title: t("metaTitle") };
}

const CARD_ICONS: Record<MyPageCard["key"], LucideIcon> = {
  verify: BadgeCheck,
  portfolio: ImageIcon,
  services: Package,
  info: FileText,
  costumes: Shirt,
  area: MapPin,
  policies: ScrollText,
  hours: CalendarClock,
  reviews: Star,
  places: MapPinned,
  share: QrCode,
};

const BLOCKER_HREF = {
  verify: "/onboarding/verification",
  photo: "/dashboard/portfolio",
  costumePhoto: "/dashboard/my-page/info#costumes",
  categories: "/dashboard/my-page/info#gioi-thieu",
  address: "/dashboard/my-page/info#khu-vuc",
} as const;

/**
 * "Trang của tôi": every part of what customers see, each with whether it
 * is done. The single place a provider sets themselves up — see
 * services/my-page.ts.
 */
export default async function MyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const status = await getMyPageStatus(session.user.id);
  // A customer has no page of their own to set up.
  if (!status) redirect("/dashboard/settings/profile");

  const t = await getTranslations("dashboardCore.myPage");
  const done = status.cards.filter((card) => card.state === "done").length;
  const countable = status.cards.filter((card) => card.state !== "info").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <p className="text-body-md text-text-secondary">
          {t("lede", { done, total: countable })}
        </p>
      </div>

      {status.published ? (
        <section className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-success/30 bg-success-bg p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-body-md font-semibold! text-text-primary">
            <CheckCircle2
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-success"
            />
            {t("published")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/profile/me"
              target="_blank"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "min-h-10",
              )}
            >
              <ExternalLink aria-hidden className="size-4" />
              {t("viewAsCustomer")}
            </Link>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-2 rounded-[var(--fg-radius-lg)] border border-warning/40 bg-warning-bg p-4">
          <p className="flex items-start gap-2 text-body-md font-semibold! text-text-primary">
            <AlertCircle
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-warning"
            />
            {t("notPublished")}
          </p>
          {status.blockers.length ? (
            <ul className="flex flex-col gap-1 pl-7 text-body-sm text-text-primary">
              {status.blockers.map((blocker) => (
                <li key={blocker}>
                  <Link
                    href={
                      blocker === "verify"
                        ? `${BLOCKER_HREF.verify}?role=${status.role}`
                        : BLOCKER_HREF[blocker]
                    }
                    className="font-semibold! text-text-link underline-offset-2 hover:underline"
                  >
                    {t(`blockers.${blocker}`)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pl-7 text-body-sm text-text-secondary">
              {t("notPublishedPlan")}
            </p>
          )}
        </section>
      )}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {status.cards.map((card) => {
          const Icon = CARD_ICONS[card.key];
          return (
            <li key={card.key}>
              <Link
                href={card.href}
                className={cn(
                  "group flex h-full min-h-[88px] items-start gap-3 rounded-[var(--fg-radius-lg)] border bg-surface-card p-4 transition-colors hover:bg-bg-sunken",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
                  card.state === "todo"
                    ? "border-warning/50"
                    : "border-border-subtle",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    card.state === "done"
                      ? "bg-success-bg text-success"
                      : card.state === "todo"
                        ? "bg-warning-bg text-warning"
                        : card.state === "waiting"
                          ? "bg-bg-sunken text-text-secondary"
                          : "bg-bg-sunken text-text-secondary",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body-md font-semibold! text-text-primary">
                      {t(`cards.${card.key}.title`)}
                    </span>
                    {card.state === "info" ? null : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta font-semibold!",
                          card.state === "done"
                            ? "bg-success-bg text-success"
                            : card.state === "todo"
                              ? "bg-warning-bg text-warning"
                              : "bg-bg-sunken text-text-secondary",
                        )}
                      >
                        {card.state === "waiting" ? (
                          <Clock aria-hidden className="size-3" />
                        ) : null}
                        {t(`state.${card.state}`)}
                      </span>
                    )}
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {t(`cards.${card.key}.${card.detail}`, card.values)}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="mt-2.5 size-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
