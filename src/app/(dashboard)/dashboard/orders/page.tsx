import { notFound } from "next/navigation";

import { features } from "@/lib/features";

import { CustomerOrdersContent } from "./customer-orders-content";

export default function CustomerOrdersPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  return <CustomerOrdersContent />;
}
