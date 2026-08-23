import { notFound } from "next/navigation";

import { features } from "@/lib/features";

import { ShopOrdersContent } from "./shop-orders-content";

export default function ShopOrdersPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  return <ShopOrdersContent />;
}
