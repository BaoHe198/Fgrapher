import type { Metadata } from "next";

import { rolePricesVnd } from "@/lib/constants/plans";

import { PricingContent } from "./pricing-content";

export const metadata: Metadata = { title: "Pricing — Fgrapher" };

export default function PricingPage() {
  return (
    <PricingContent
      monthlyPrices={rolePricesVnd("month")}
      yearlyPrices={rolePricesVnd("year")}
    />
  );
}
