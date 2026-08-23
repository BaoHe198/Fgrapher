import { notFound } from "next/navigation";

import { features } from "@/lib/features";

import { CartContent } from "./cart-content";

export default function CartPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  return <CartContent />;
}
