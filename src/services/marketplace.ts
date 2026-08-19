import type { Prisma, ProductCondition, ProductType } from "@prisma/client";

import { db } from "@/lib/db";

const PAGE_SIZE = 24;

export interface ShopSearchParams {
  type?: "SALE" | "RENT";
  category?: string[];
  condition?: ProductCondition[];
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc";
  page?: number;
}

function priceField(type?: "SALE" | "RENT") {
  return type === "RENT" ? "rentalPrice" : "price";
}

export async function searchProducts(params: ShopSearchParams) {
  const page = Math.max(1, params.page ?? 1);

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
  };

  if (params.type) {
    where.type = { in: [params.type, "BOTH"] };
  }
  if (params.category?.length) {
    where.category = { in: params.category };
  }
  if (params.condition?.length) {
    where.condition = { in: params.condition };
  }
  if (params.inStockOnly) {
    where.stock = { gt: 0 };
  }
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    const field = priceField(params.type);
    where[field] = {
      ...(params.priceMin !== undefined ? { gte: params.priceMin } : {}),
      ...(params.priceMax !== undefined ? { lte: params.priceMax } : {}),
    };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    params.sort === "price_asc"
      ? { price: "asc" }
      : params.sort === "price_desc"
        ? { price: "desc" }
        : { createdAt: "desc" };

  const [products, total, categoryCounts] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        user: { select: { id: true, name: true, firstName: true, avatar: true, username: true } },
      },
    }),
    db.product.count({ where }),
    db.product.groupBy({
      by: ["category"],
      where: { isActive: true, deletedAt: null },
      _count: true,
    }),
  ]);

  return {
    data: products,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    facets: { categories: categoryCounts.map((c) => ({ category: c.category, count: c._count })) },
  };
}

export async function getProductDetail(id: string) {
  const product = await db.product.findUnique({
    where: { id, isActive: true, deletedAt: null },
    include: {
      images: { orderBy: { order: "asc" } },
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          avatar: true,
          username: true,
          location: true,
          profiles: {
            where: { role: "CAMERA_SHOP" },
            select: { shopName: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!product) return null;

  const [related, reviewStats] = await Promise.all([
    db.product.findMany({
      where: { userId: product.userId, isActive: true, deletedAt: null, id: { not: product.id } },
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { images: { orderBy: { order: "asc" }, take: 1 } },
    }),
    db.review.aggregate({
      where: { reviewedId: product.userId },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  return {
    product,
    related,
    shopRating: reviewStats._avg.rating ?? 0,
    shopReviewCount: reviewStats._count,
  };
}

type CartProductType = ProductType;

export async function getCart(userId: string) {
  const items = await db.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: {
          images: { orderBy: { order: "asc" }, take: 1 },
          user: { select: { id: true, name: true, firstName: true, profiles: { where: { role: "CAMERA_SHOP" }, select: { shopName: true }, take: 1 } } },
        },
      },
    },
  });
  return items;
}

export class CartError extends Error {
  constructor(
    message: string,
    public status: 400 | 404,
  ) {
    super(message);
    this.name = "CartError";
  }
}

export async function addToCart({
  userId,
  productId,
  quantity,
  type,
  rentalStart,
  rentalEnd,
}: {
  userId: string;
  productId: string;
  quantity: number;
  type: CartProductType;
  rentalStart?: Date;
  rentalEnd?: Date;
}) {
  const product = await db.product.findUnique({ where: { id: productId, isActive: true, deletedAt: null } });
  if (!product) throw new CartError("Product not found", 404);

  if (type === "SALE" && product.stock < quantity) {
    throw new CartError("Not enough stock available", 400);
  }
  if (type === "RENT" && (!rentalStart || !rentalEnd)) {
    throw new CartError("Rental dates are required", 400);
  }
  if (type === "RENT" && rentalStart && rentalEnd) {
    const overlapping = await db.orderItem.findFirst({
      where: {
        productId,
        type: "RENT",
        order: { status: { in: ["PENDING", "CONFIRMED", "SHIPPED"] } },
        rentalStart: { lt: rentalEnd },
        rentalEnd: { gt: rentalStart },
      },
    });
    if (overlapping) throw new CartError("This item is already booked for those dates", 400);
  }

  const existing = await db.cartItem.findFirst({
    where: {
      userId,
      productId,
      type,
      rentalStart: rentalStart ?? null,
      rentalEnd: rentalEnd ?? null,
    },
  });

  if (existing) {
    return db.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  }

  return db.cartItem.create({
    data: { userId, productId, quantity, type, rentalStart, rentalEnd },
  });
}

export async function updateCartItemQuantity(id: string, userId: string, quantity: number) {
  const item = await db.cartItem.findUnique({ where: { id }, include: { product: true } });
  if (!item || item.userId !== userId) throw new CartError("Cart item not found", 404);

  if (item.type === "SALE" && item.product.stock < quantity) {
    throw new CartError("Not enough stock available", 400);
  }

  return db.cartItem.update({ where: { id }, data: { quantity } });
}

export async function removeCartItem(id: string, userId: string) {
  await db.cartItem.deleteMany({ where: { id, userId } });
}

export async function clearCart(userId: string) {
  await db.cartItem.deleteMany({ where: { userId } });
}
