import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { features } from "@/lib/features";
import { rolePricesVnd } from "@/lib/constants/plans";

import { AuthTabs } from "./auth-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountFlows.login");
  return { title: t("metaTitle") };
}

interface LoginPageProps {
  searchParams: Promise<{
    mode?: string;
    role?: string;
    interval?: string;
    callbackUrl?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const interval = params.interval === "year" ? "year" : "month";

  return (
    <AuthTabs
      // Role checkboxes always show the monthly rate — the chosen interval
      // only affects what's actually charged, confirmed on the
      // onboarding/billing screen right before checkout.
      rolePrices={rolePricesVnd("month")}
      initialRole={params.role}
      interval={interval}
      callbackUrl={params.callbackUrl}
      hasError={Boolean(params.error)}
      marketplaceEnabled={features.marketplaceEnabled}
    />
  );
}
