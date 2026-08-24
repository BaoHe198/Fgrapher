import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/forms/product-form";
import { SubscriptionGate } from "@/components/subscription-gate";
import { features } from "@/lib/features";

export default async function NewProductPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const t = await getTranslations("dashboardCore.listings");

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-display-md text-text-primary">
        {t("addProductTitle")}
      </h1>
      <SubscriptionGate
        role="CAMERA_SHOP"
        fallbackTitle={t("gate.fallbackTitle")}
        fallbackText={t("gate.fallbackText")}
      >
        <ProductForm />
      </SubscriptionGate>
    </div>
  );
}
