import type { Metadata } from "next";

import { PricingContent } from "./pricing-content";

export const metadata: Metadata = { title: "Pricing — Fgrapher" };

export default function PricingPage() {
  return <PricingContent />;
}
