import { notFound } from "next/navigation";

import { features } from "@/lib/features";

import { CheckoutSuccessContent } from "./checkout-success-content";

export default function CheckoutSuccessPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  return <CheckoutSuccessContent />;
}
