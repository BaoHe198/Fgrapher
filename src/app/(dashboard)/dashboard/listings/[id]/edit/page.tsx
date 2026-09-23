import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/forms/product-form";
import { auth } from "@/lib/auth";
import { SELLER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import type { PRODUCT_CATEGORIES } from "@/lib/validations/product";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } } },
  });

  if (!product || product.deletedAt || product.userId !== session.user.id) {
    notFound();
  }
  const sellerRole = SELLER_ROLES.find((role) =>
    session.user.roles.includes(role),
  );
  if (!sellerRole) notFound();

  const t = await getTranslations("dashboardCore.listings");

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-display-md text-text-primary">
        {t("editProductTitle")}
      </h1>
      <ProductForm
        productId={product.id}
        sellerRole={sellerRole}
        defaultValues={{
          name: product.name,
          description: product.description ?? "",
          category: product.category as (typeof PRODUCT_CATEGORIES)[number],
          type: product.type,
          price: product.price ?? undefined,
          rentalPrice: product.rentalPrice ?? undefined,
          depositAmount: product.depositAmount ?? undefined,
          condition: product.condition,
          stock: product.stock,
          isActive: product.isActive,
          images: product.images.map((img) => ({
            url: img.url,
            // Existing rows from before server-side upload verification may
            // lack a public ID. Keeping an empty value makes the form show
            // its existing image, while validation prevents that unverified
            // asset from being resubmitted; the seller can replace it.
            publicId: img.publicId ?? "",
          })),
        }}
      />
    </div>
  );
}
