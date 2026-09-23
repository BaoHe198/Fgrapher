import type { ProductType } from "@prisma/client";

import { verifyPortfolioUpload } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import type { ProductInput } from "@/lib/validations/product";
import { runProductImageModeration } from "@/services/moderation";

export type ListingFilter = "ALL" | "SALE" | "RENT" | "OUT_OF_STOCK";

export async function listProducts({
  userId,
  filter,
}: {
  userId: string;
  filter: ListingFilter;
}) {
  const where =
    filter === "OUT_OF_STOCK"
      ? { userId, deletedAt: null, stock: 0 }
      : filter === "SALE" || filter === "RENT"
        ? {
            userId,
            deletedAt: null,
            type: { in: [filter, "BOTH"] as ProductType[] },
          }
        : { userId, deletedAt: null };

  return db.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      images: {
        orderBy: { order: "asc" },
        take: 1,
        select: { url: true, moderationStatus: true },
      },
    },
  });
}

export async function createProduct(userId: string, input: ProductInput) {
  for (const image of input.images) {
    await verifyPortfolioUpload({
      publicId: image.publicId,
      url: image.url,
      userId,
      type: "IMAGE",
    });
  }

  const product = await db.product.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      category: input.category,
      type: input.type,
      price: input.price,
      rentalPrice: input.rentalPrice,
      depositAmount: input.depositAmount,
      condition: input.condition,
      stock: input.stock,
      isActive: input.isActive,
      images: {
        create: input.images.map((img, index) => ({ ...img, order: index })),
      },
    },
    include: { images: true },
  });

  // Fire-and-forget tier-1 scan, exactly as POST /api/portfolio does: every
  // image is PENDING regardless, the scan only decides what the admin sees
  // first (services/moderation.ts).
  for (const image of product.images) {
    void runProductImageModeration(image.id);
  }

  return product;
}

export async function updateProduct(
  id: string,
  userId: string,
  input: ProductInput,
) {
  const existing = await db.product.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!existing || existing.userId !== userId) {
    return null;
  }

  const existingImages = new Set(
    existing.images
      .filter((image): image is typeof image & { publicId: string } =>
        Boolean(image.publicId),
      )
      .map((image) => `${image.publicId}\u0000${image.url}`),
  );

  // The edit form submits retained images too. Verify only newly introduced
  // assets, and do it before deleting old image rows inside the transaction.
  for (const image of input.images) {
    if (existingImages.has(`${image.publicId}\u0000${image.url}`)) continue;
    await verifyPortfolioUpload({
      publicId: image.publicId,
      url: image.url,
      userId,
      type: "IMAGE",
    });
  }

  return db.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        type: input.type,
        price: input.price,
        rentalPrice: input.rentalPrice,
        depositAmount: input.depositAmount,
        condition: input.condition,
        stock: input.stock,
        isActive: input.isActive,
        images: {
          create: input.images.map((img, index) => ({ ...img, order: index })),
        },
      },
      include: { images: true },
    });
  });
}

export async function deleteProduct(id: string, userId: string) {
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return false;
  }

  await db.product.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return true;
}

export async function duplicateProduct(id: string, userId: string) {
  const existing = await db.product.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!existing || existing.userId !== userId) {
    return null;
  }

  return db.product.create({
    data: {
      userId,
      name: `${existing.name} (copy)`,
      description: existing.description,
      category: existing.category,
      type: existing.type,
      price: existing.price,
      rentalPrice: existing.rentalPrice,
      condition: existing.condition,
      stock: existing.stock,
      isActive: false,
      images: {
        create: existing.images.map((img) => ({
          url: img.url,
          publicId: img.publicId,
          order: img.order,
        })),
      },
    },
    include: { images: true },
  });
}
