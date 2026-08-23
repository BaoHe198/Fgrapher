import { notFound } from "next/navigation";

import { features } from "@/lib/features";

import { OrderDetailContent } from "./order-detail-content";

export default function OrderDetailPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  return <OrderDetailContent />;
}
