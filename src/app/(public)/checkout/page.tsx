import { notFound } from "next/navigation";

import { features } from "@/lib/features";

import { CheckoutContent } from "./checkout-content";

export default function CheckoutPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  return <CheckoutContent />;
}
