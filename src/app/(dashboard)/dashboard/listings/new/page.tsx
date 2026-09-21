import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/forms/product-form";
import { SubscriptionGate } from "@/components/subscription-gate";
import { auth } from "@/lib/auth";
import { SELLER_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";

export default async function NewProductPage() {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/listings/new");

  const t = await getTranslations("dashboardCore.listings");
  // Whichever gear-owning role this account holds: Chợ F lists photo/video
  // equipment, so a photographer or studio sells here too, not just a shop.
  const sellerRole = SELLER_ROLES.find((role) =>
    session.user.roles.includes(role),
  );
  if (!sellerRole) redirect("/dashboard/listings");

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-display-md text-text-primary">
        {t("addProductTitle")}
      </h1>
      <SubscriptionGate
        role={sellerRole}
        fallbackTitle={t("gate.fallbackTitle")}
        fallbackText={t("gate.fallbackText")}
      >
        <ProductForm />
      </SubscriptionGate>
    </div>
  );
}
