import type { Metadata } from "next";

import { features } from "@/lib/features";
import { rolePricesVnd } from "@/lib/constants/plans";

import { AuthTabs } from "./auth-tabs";

export const metadata: Metadata = {
  title: "Sign in or create an account — Fgrapher",
};

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
