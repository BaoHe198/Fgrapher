import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/forms/product-form";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { PRODUCT_CATEGORIES } from "@/lib/validations/product";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-display-md text-text-primary">Edit product</h1>
      <ProductForm
        productId={product.id}
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
          images: product.images.map((img) => ({ url: img.url, publicId: img.publicId ?? undefined })),
        }}
      />
    </div>
  );
}
