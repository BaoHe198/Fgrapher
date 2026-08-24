import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { rolePricesVnd } from "@/lib/constants/plans";
import { features } from "@/lib/features";

import { PricingContent } from "./pricing-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publicPages.pricing");
  return { title: t("pageTitle") };
}

export default function PricingPage() {
  return (
    <PricingContent
      monthlyPrices={rolePricesVnd("month")}
      yearlyPrices={rolePricesVnd("year")}
      billingEnabled={features.billingEnabled}
      marketplaceEnabled={features.marketplaceEnabled}
    />
  );
}
