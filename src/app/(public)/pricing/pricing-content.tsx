"use client";

import type { Role } from "@prisma/client";
import {
  Building2,
  Camera,
  Check,
  type LucideIcon,
  Sparkles,
  ShoppingBag,
  UserRound,
  Video,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";

interface Plan {
  role: Role;
  icon: LucideIcon;
  popular?: boolean;
  descriptionKey: string;
  featuresKey: string;
}

const PLANS: Plan[] = [
  {
    role: "PHOTOGRAPHER",
    icon: Camera,
    popular: true,
    descriptionKey: "plans.photographer.description",
    featuresKey: "plans.photographer.features",
  },
  {
    role: "VIDEOGRAPHER",
    icon: Video,
    descriptionKey: "plans.videographer.description",
    featuresKey: "plans.videographer.features",
  },
  {
    role: "MAKEUP_ARTIST",
    icon: Sparkles,
    descriptionKey: "plans.makeupArtist.description",
    featuresKey: "plans.makeupArtist.features",
  },
  {
    role: "MODEL",
    icon: UserRound,
    descriptionKey: "plans.model.description",
    featuresKey: "plans.model.features",
  },
  {
    role: "STUDIO",
    icon: Building2,
    descriptionKey: "plans.studio.description",
    featuresKey: "plans.studio.features",
  },
  {
    role: "CAMERA_SHOP",
    icon: ShoppingBag,
    descriptionKey: "plans.cameraShop.description",
    featuresKey: "plans.cameraShop.features",
  },
];

const FAQ_KEYS = [
  "faqs.multipleRoles",
  "faqs.afterTrial",
  "faqs.cancelAnytime",
  "faqs.commission",
  "faqs.paymentMethods",
  "faqs.annualDiscount",
] as const;

const COMPARISON_FEATURES_KEY = "comparisonFeatures";

const COMPARISON_MATRIX: Record<Role, boolean[]> = {
  PHOTOGRAPHER: [true, true, true, true, true, true],
  VIDEOGRAPHER: [true, true, true, true, true, true],
  MAKEUP_ARTIST: [true, true, true, true, true, true],
  STUDIO: [true, true, true, true, false, false],
  CAMERA_SHOP: [true, false, true, false, false, false],
  // Full Model plan card (§3c) still pending — this keeps the comparison
  // table's type exhaustive in the meantime, same row shape as Make-up
  // Artist since Model has identical capabilities (see role-permissions).
  MODEL: [true, true, true, true, true, true],
  CUSTOMER: [false, false, false, false, false, false],
  ADMIN: [false, false, false, false, false, false],
};

export function PricingContent({
  monthlyPrices,
  yearlyPrices,
  billingEnabled,
  marketplaceEnabled,
}: {
  monthlyPrices: Partial<Record<Role, number>>;
  yearlyPrices: Partial<Record<Role, number>>;
  billingEnabled: boolean;
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("publicPages.pricing");
  const [yearly, setYearly] = useState(false);
  const plans = marketplaceEnabled
    ? PLANS
    : PLANS.filter((plan) => plan.role !== "CAMERA_SHOP");

  const billingToggleLabels = {
    Monthly: t("billingToggle.monthly"),
    Yearly: t("billingToggle.yearly"),
  } as const;

  return (
    <div className="flex flex-col">
      {!billingEnabled ? (
        <div className="bg-gold-500 px-6 py-2.5 text-center text-body-sm font-semibold text-text-on-brand">
          {t("freeDuringLaunch")}
        </div>
      ) : null}
      <section className="bg-green-900 px-6 py-20 text-center">
        <span className="text-caption-upper tracking-[0.14em] text-gold-300">
          {t("eyebrow")}
        </span>
        <h1 className="mt-3 text-display-xl text-gold-50">{t("heroTitle")}</h1>
        <p className="mx-auto mt-3 max-w-[560px] text-body-lg text-green-200">
          {t("heroSub")}
        </p>

        <div className="mx-auto mt-6 inline-flex overflow-hidden rounded-full border border-border-subtle bg-bg-surface">
          {(["Monthly", "Yearly"] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setYearly(label === "Yearly")}
              className={cn(
                "px-4 py-1.5 text-body-sm font-bold transition-colors duration-150",
                yearly === (label === "Yearly")
                  ? "bg-brand-primary text-text-on-brand"
                  : "text-text-secondary",
              )}
            >
              {billingToggleLabels[label]}
              {label === "Yearly" ? ` ${t("billingToggle.saveNote")}` : ""}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <Card className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <span className="text-heading-lg text-text-primary">
              {t("customerFree.heading")}
            </span>
            <span className="text-body-md text-text-secondary">
              {t("customerFree.sub")}
            </span>
          </div>
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/login?mode=register" />}
          >
            {t("customerFree.signUp")}
          </Button>
        </Card>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const displayPrice =
              (yearly ? yearlyPrices : monthlyPrices)[plan.role] ?? 0;

            return (
              <Card
                key={plan.role}
                className={cn(
                  "flex flex-col gap-4",
                  plan.popular && "border-2 border-gold-400",
                )}
              >
                {plan.popular ? (
                  <span className="w-fit rounded-full bg-brand-primary px-2.5 py-1 text-body-sm font-bold text-text-on-brand">
                    {t("mostPopular")}
                  </span>
                ) : null}

                <div className="flex size-12 items-center justify-center rounded-full bg-success-bg">
                  <Icon className="size-5 text-brand-primary" />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-heading-lg text-text-primary">
                    {ROLE_LABELS[plan.role]}
                  </span>
                  <span className="text-display-md text-text-primary">
                    {formatCurrency(displayPrice, "VND")}
                    <span className="text-body-sm font-normal text-text-secondary">
                      /{yearly ? t("perYear") : t("perMonth")}
                    </span>
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {t(plan.descriptionKey)}
                  </span>
                </div>

                <div className="border-t border-border-subtle pt-4">
                  <ul className="flex flex-col gap-2.5">
                    {(t.raw(plan.featuresKey) as string[]).map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-body-sm"
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        <span className="text-text-primary">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant={plan.popular ? "accent" : "secondary"}
                  className="w-full"
                  nativeButton={false}
                  render={
                    <Link
                      href={`/login?mode=register&role=${plan.role}${yearly ? "&interval=year" : ""}`}
                    />
                  }
                >
                  {billingEnabled ? t("startTrial") : t("signUpFree")}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <h2 className="mb-6 text-heading-xl text-text-primary">
          {t("comparePlans")}
        </h2>
        <Card padding={false} className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-text-tertiary">
                  {t("featureColumn")}
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.role}
                    className="px-3 py-3 text-center text-text-primary"
                  >
                    {ROLE_LABELS[plan.role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(t.raw(COMPARISON_FEATURES_KEY) as string[]).map(
                (feature, i) => (
                  <tr
                    key={feature}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    <td className="px-5 py-3 text-text-secondary">{feature}</td>
                    {plans.map((plan) => (
                      <td key={plan.role} className="px-3 py-3 text-center">
                        {COMPARISON_MATRIX[plan.role][i] ? (
                          <Check className="mx-auto size-4 text-success" />
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-2xl px-6 py-12">
        <h2 className="mb-4 text-heading-xl text-text-primary">
          {t("faqHeading")}
        </h2>
        <Accordion multiple>
          {FAQ_KEYS.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger>{t(`${key}.q`)}</AccordionTrigger>
              <AccordionPanel>
                <p className="pb-4">{t(`${key}.a`)}</p>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="bg-bg-sunken px-6 py-16 text-center">
        <h2 className="text-heading-xl text-text-primary">
          {t("stillDeciding")}
        </h2>
        <Button
          variant="secondary"
          className="mt-4"
          nativeButton={false}
          render={<Link href="/contact" />}
        >
          {t("talkToUs")}
        </Button>
      </section>
    </div>
  );
}
