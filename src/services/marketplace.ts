import { getTranslations } from "next-intl/server";
import type { Prisma, ProductCondition, ProductType } from "@prisma/client";

import { SELLER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  escapeLike,
  foldVietnamese,
  SQL_FOLD_FROM,
  SQL_FOLD_TO,
} from "@/lib/vietnamese-fold";
import {
  normalizeProductCategory,
  productCategoryQueryValues,
} from "@/lib/validations/product";

const PAGE_SIZE = 24;

export interface ShopSearchParams {
  sellerId?: string;
  /** Free-text match on the listing's name or description. */
  q?: string;
  type?: "SALE" | "RENT";
  category?: string[];
  condition?: ProductCondition[];
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  // Where the seller is based. Gear is collected or shipped from the
  // seller's own address, so "near me" is a real filter here, not a nicety.
  // Filters on the SELLER's profile, not on the product.
  provinceId?: string;
  wardId?: string;
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
    ...(params.sellerId ? { userId: params.sellerId } : {}),
  };

  const q = params.q?.trim();
  if (q) {
    // Accent-insensitive, like profile search: "den flash" finds "Đèn
    // flash" (see lib/vietnamese-fold.ts).
    const pattern = `%${escapeLike(foldVietnamese(q))}%`;
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM products
      WHERE lower(translate(
        concat_ws(' ', name, description), ${SQL_FOLD_FROM}, ${SQL_FOLD_TO}
      )) LIKE ${pattern}
    `;
    where.id = { in: rows.map((row) => row.id) };
  }
  if (params.type) {
    where.type = { in: [params.type, "BOTH"] };
  }
  if (params.category?.length) {
    // Accepts the legacy label for each requested category too, so a
    // database that still holds un-migrated rows filters the same way a
    // migrated one does (see LEGACY_PRODUCT_CATEGORY_ALIASES).
    where.category = { in: productCategoryQueryValues(params.category) };
  }
  if (params.condition?.length) {
    where.condition = { in: params.condition };
  }
  if (params.inStockOnly) {
    where.stock = { gt: 0 };
  }
  if (params.provinceId || params.wardId) {
    where.user = {
      profiles: {
        some: {
          role: { in: SELLER_ROLES },
          ...(params.provinceId ? { provinceId: params.provinceId } : {}),
          ...(params.wardId ? { wardId: params.wardId } : {}),
        },
      },
    };
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
      relationLoadStrategy: "join",
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: {
          where: { moderationStatus: "APPROVED" },
          orderBy: { order: "asc" },
          take: 1,
        },
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            avatar: true,
            username: true,
          },
        },
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
    facets: {
      // Counted under the canonical name, so a legacy row is counted on the
      // checkbox that would actually return it. An unrecognised category is
      // kept as-is rather than dropped: a count nobody can click is still
      // better than a product the facet pretends does not exist.
      categories: Object.entries(
        categoryCounts.reduce<Record<string, number>>((acc, c) => {
          const key = normalizeProductCategory(c.category) ?? c.category;
          acc[key] = (acc[key] ?? 0) + c._count;
          return acc;
        }, {}),
      ).map(([category, count]) => ({ category, count })),
    },
  };
}

export async function getProductDetail(id: string) {
  const product = await db.product.findUnique({
    // One LATERAL-joined statement instead of one per relation level. Against
    // the transaction pooler each Prisma operation costs BEGIN / DEALLOCATE
    // ALL / query / COMMIT, so the statement count is what this page pays
    // for, not the work.
    relationLoadStrategy: "join",
    where: { id, isActive: true, deletedAt: null },
    include: {
      images: {
        where: { moderationStatus: "APPROVED" },
        orderBy: { order: "asc" },
      },
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          avatar: true,
          username: true,
          location: true,
          profiles: {
            // Both seller roles list products — a costume shop's name went
            // missing here while this filtered on CAMERA_SHOP alone.
            where: { role: { in: SELLER_ROLES } },
            select: {
              shopName: true,
              deliveryFee: true,
              province: { select: { name: true } },
              ward: { select: { name: true } },
            },
            take: 1,
          },
        },
      },
    },
  });
  if (!product) return null;

  const [related, reviewStats] = await Promise.all([
    db.product.findMany({
      where: {
        userId: product.userId,
        isActive: true,
        deletedAt: null,
        id: { not: product.id },
      },
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
    relationLoadStrategy: "join",
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: {
          images: {
            where: { moderationStatus: "APPROVED" },
            orderBy: { order: "asc" },
            take: 1,
          },
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              profiles: {
                where: { role: { in: SELLER_ROLES } },
                select: {
                  shopName: true,
                  deliveryFee: true,
                  province: { select: { name: true } },
                  ward: { select: { name: true } },
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  return items;
}

export type CartErrorCode =
  | "productNotFound"
  | "rentalByMessage"
  | "notEnoughStock"
  | "alreadyAtStock"
  | "itemNotFound";

// English `message` for logs; users read the translated `code` (see
// cartErrorMessage), as with OrderError.
export class CartError extends Error {
  constructor(
    message: string,
    public status: 400 | 404,
    public code?: CartErrorCode,
    public params: Record<string, string | number> = {},
  ) {
    super(message);
    this.name = "CartError";
  }
}

/** The user-facing, translated text for a CartError. */
export async function cartErrorMessage(err: CartError) {
  if (!err.code) return err.message;
  const t = await getTranslations("apiMessages.cartErrors");
  return t(err.code, err.params);
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
  const product = await db.product.findUnique({
    where: { id: productId, isActive: true, deletedAt: null },
  });
  if (!product)
    throw new CartError("Product not found", 404, "productNotFound");

  if (type === "RENT") {
    throw new CartError(
      "Rentals are arranged directly with the shop by message",
      400,
      "rentalByMessage",
    );
  }

  if (type === "SALE" && product.stock < quantity) {
    throw new CartError("Not enough stock available", 400, "notEnoughStock", {
      stock: product.stock,
    });
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
    // Adding again merged into the existing line with no stock check, so a
    // second tap put 2 of a last-one item in the cart and checkout failed
    // later (24/09 audit).
    if (type === "SALE" && existing.quantity + quantity > product.stock) {
      throw new CartError("Not enough stock available", 400, "alreadyAtStock", {
        inCart: existing.quantity,
        stock: product.stock,
      });
    }
    return db.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  }

  return db.cartItem.create({
    data: { userId, productId, quantity, type, rentalStart, rentalEnd },
  });
}

export async function updateCartItemQuantity(
  id: string,
  userId: string,
  quantity: number,
) {
  const item = await db.cartItem.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!item || item.userId !== userId)
    throw new CartError("Cart item not found", 404, "itemNotFound");

  if (item.type === "SALE" && item.product.stock < quantity) {
    throw new CartError("Not enough stock available", 400, "notEnoughStock", {
      stock: item.product.stock,
    });
  }

  return db.cartItem.update({ where: { id }, data: { quantity } });
}

export async function removeCartItem(id: string, userId: string) {
  await db.cartItem.deleteMany({ where: { id, userId } });
}

export async function clearCart(userId: string) {
  await db.cartItem.deleteMany({ where: { userId } });
}
