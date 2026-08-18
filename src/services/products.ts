import type { ProductType } from "@prisma/client";

import { db } from "@/lib/db";
import type { ProductInput } from "@/lib/validations/product";

export type ListingFilter = "ALL" | "SALE" | "RENT" | "OUT_OF_STOCK";

export async function listProducts({ userId, filter }: { userId: string; filter: ListingFilter }) {
  const where =
    filter === "OUT_OF_STOCK"
      ? { userId, deletedAt: null, stock: 0 }
      : filter === "SALE" || filter === "RENT"
        ? { userId, deletedAt: null, type: { in: [filter, "BOTH"] as ProductType[] } }
        : { userId, deletedAt: null };

  return db.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
  });
}

export async function createProduct(userId: string, input: ProductInput) {
  return db.product.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      category: input.category,
      type: input.type,
      price: input.price,
      rentalPrice: input.rentalPrice,
      condition: input.condition,
      stock: input.stock,
      isActive: input.isActive,
      images: { create: input.images.map((img, index) => ({ ...img, order: index })) },
    },
    include: { images: true },
  });
}

export async function updateProduct(id: string, userId: string, input: ProductInput) {
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return null;
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
        condition: input.condition,
        stock: input.stock,
        isActive: input.isActive,
        images: { create: input.images.map((img, index) => ({ ...img, order: index })) },
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

  await db.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  return true;
}

export async function duplicateProduct(id: string, userId: string) {
  const existing = await db.product.findUnique({ where: { id }, include: { images: true } });
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
