import type { Role } from "@prisma/client";
import {
  Building2,
  Camera,
  type LucideIcon,
  Palette,
  Plus,
  Shirt,
  ShoppingBag,
  Sparkles,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DISCOVERABLE_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.pricing");
  return { title: t("pageTitle") };
}

const ROLE_ICONS: Partial<Record<Role, LucideIcon>> = {
  PHOTOGRAPHER: Camera,
  VIDEOGRAPHER: Video,
  MAKEUP_ARTIST: Palette,
  STUDIO: Building2,
  MODEL: Sparkles,
  COSTUME_SHOP: Shirt,
};

const BENEFITS = [
  "profile",
  "bookings",
  "offers",
  "calendar",
  "discovery",
  "verified",
] as const;

const FAQ = ["when", "autoCharge", "deposit", "payout", "cancel"] as const;

// Bảng giá (Core MVP pass, 02/10/2026): one honest statement - free during
// launch - instead of plan cards nobody can buy. What you get, who it
// covers and the questions people ask before signing up; Chợ F and Cộng
// đồng F lines appear only while their flags are on. The plan cards and
// comparison table stay in pricing-content.tsx for when fees arrive.
//
// The policy wording (30 days' notice, no deposit collection, no automatic
// charge) is a business/legal commitment - confirm it with the owner's
// lawyer before real users read it.
export default async function PricingPage() {
  const t = await getTranslations("publicPages.pricing.launch");
  const roleT = await getTranslations("publicPages.browse.v3.railRoles");

  const benefits: string[] = [...BENEFITS];
  if (features.marketplaceEnabled) benefits.push("market");
  if (features.socialFeedEnabled) benefits.push("community");
  const faq: string[] = [...FAQ];
  if (features.marketplaceEnabled) faq.push("market");

  const groups = DISCOVERABLE_ROLES.map((role) => ({
    key: role,
    label: roleT(role as "STUDIO"),
    Icon: ROLE_ICONS[role] ?? Camera,
  }));
  if (features.marketplaceEnabled) {
    groups.push({
      key: "CAMERA_SHOP",
      label: t("sellerGroup"),
      Icon: ShoppingBag,
    });
  }

  return (
    <div className="text-text-primary">
      <section
        aria-labelledby="pricing-title"
        data-surface="darkroom"
        className="bg-dr-bg text-dr-text"
      >
        <div className="mx-auto flex max-w-[1080px] flex-col gap-4 px-4 pt-9 pb-8 sm:px-6 md:pt-20 md:pb-18">
          <span className="text-body-sm font-semibold text-(--dr-accent)">
            {t("eyebrow")}
          </span>
          <h1
            id="pricing-title"
            className="max-w-[760px] font-display text-[clamp(32px,4.4vw,60px)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance"
          >
            {t("title")}
          </h1>
          <p className="max-w-[640px] text-body-md leading-[1.6] text-pretty text-dr-text-2">
            {t("lead")}
          </p>
          <div>
            <Button
              variant="accent"
              size="lg"
              nativeButton={false}
              render={<Link href="/login?mode=register" />}
            >
              {t("cta")}
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="pricing-benefits"
        className="mx-auto max-w-[1080px] px-4 pt-8 pb-2 sm:px-6 md:pt-16 md:pb-4"
      >
        <h2
          id="pricing-benefits"
          className="mb-4 text-heading-lg text-text-primary"
        >
          {t("benefitsHeading")}
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
          {benefits.map((key) => (
            <li
              key={key}
              className="flex flex-col gap-1.5 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-[18px]"
            >
              <strong className="text-body-md font-semibold text-text-primary">
                {t(`benefits.${key}.t` as "benefits.profile.t")}
              </strong>
              <span className="text-body-sm text-text-secondary">
                {t(`benefits.${key}.d` as "benefits.profile.d")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="pricing-groups"
        className="mx-auto max-w-[1080px] px-4 pt-8 pb-2 sm:px-6 md:pt-12 md:pb-4"
      >
        <h2
          id="pricing-groups"
          className="mb-1.5 text-heading-lg text-text-primary"
        >
          {t("groupsHeading")}
        </h2>
        <p className="mb-4 text-body-sm text-text-secondary">
          {t("groupsLead")}
        </p>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-3">
          {groups.map(({ key, label, Icon }) => (
            <li
              key={key}
              className="flex items-center gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-surface p-2"
            >
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-[var(--fg-radius-sm)] bg-bg-sunken text-text-secondary"
              >
                <Icon className="size-5" />
              </span>
              <span className="text-body-sm font-semibold text-text-primary">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="pricing-faq"
        className="mx-auto max-w-[1080px] px-4 pt-8 pb-12 sm:px-6 md:pt-12 md:pb-24"
      >
        <h2 id="pricing-faq" className="mb-3 text-heading-lg text-text-primary">
          {t("faqHeading")}
        </h2>
        <div className="flex flex-col border-t border-border-subtle">
          {faq.map((key) => (
            <details key={key} className="group border-b border-border-subtle">
              <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-2 text-body-md font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
                {t(`faq.${key}.q` as "faq.when.q")}
                <Plus
                  aria-hidden
                  className="size-5 shrink-0 text-text-secondary transition-transform duration-[var(--fg-dur-150)] group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-[720px] pb-4 text-body-md leading-[1.6] text-text-secondary">
                {t(`faq.${key}.a` as "faq.when.a")}
              </p>
            </details>
          ))}
        </div>
        <p className="mt-5 text-body-sm text-text-secondary">
          {t("moreQuestions")}{" "}
          <Link
            href="/contact"
            className="focus-ring inline-flex min-h-11 items-center rounded-[var(--fg-radius-sm)] font-semibold text-text-link"
          >
            {t("contact")}
          </Link>
        </p>
      </section>
    </div>
  );
}
