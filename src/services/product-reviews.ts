import { db } from "@/lib/db";

export class ProductReviewError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "ProductReviewError";
  }
}

/**
 * An order can be reviewed once the customer actually has the goods. For a
 * sale that is DELIVERED; for a rental it is only once the item is back
 * (RETURNED), which is when they have seen the whole transaction through —
 * the plan calls this "đánh giá sau khi trả đồ".
 */
const REVIEWABLE_SALE_STATUSES = ["DELIVERED"] as const;
const REVIEWABLE_RENTAL_STATUSES = ["RETURNED"] as const;

export async function createProductReview({
  orderId,
  productId,
  reviewerId,
  rating,
  content,
}: {
  orderId: string;
  productId: string;
  reviewerId: string;
  rating: number;
  content?: string;
}) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      shopId: true,
      status: true,
      items: { select: { productId: true, type: true } },
    },
  });
  if (!order) throw new ProductReviewError("Order not found", 404);
  if (order.customerId !== reviewerId) {
    throw new ProductReviewError("This is not your order", 403);
  }

  const item = order.items.find((i) => i.productId === productId);
  if (!item) {
    throw new ProductReviewError("That item is not in this order", 404);
  }

  const allowed =
    item.type === "RENT"
      ? (REVIEWABLE_RENTAL_STATUSES as readonly string[])
      : (REVIEWABLE_SALE_STATUSES as readonly string[]);
  if (!allowed.includes(order.status)) {
    throw new ProductReviewError(
      item.type === "RENT"
        ? "You can review a rental once it has been returned"
        : "You can review an item once it has been delivered",
      409,
    );
  }

  const existing = await db.productReview.findUnique({
    where: { orderId_productId: { orderId, productId } },
  });
  if (existing) {
    throw new ProductReviewError("You already reviewed this item", 409);
  }

  return db.productReview.create({
    data: {
      orderId,
      productId,
      reviewerId,
      shopId: order.shopId,
      rating,
      content,
    },
  });
}

export async function listProductReviews(productId: string) {
  return db.productReview.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      content: true,
      response: true,
      createdAt: true,
      reviewer: { select: { name: true, firstName: true, avatar: true } },
    },
  });
}

/** Average and count for one product, for the card and the detail page. */
export async function getProductRating(productId: string) {
  const result = await db.productReview.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  return {
    average: result._avg.rating ?? 0,
    count: result._count.rating,
  };
}

/** Which items of an order this customer may still review. */
export async function pendingReviewsForOrder(orderId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      customerId: true,
      status: true,
      items: {
        select: {
          productId: true,
          type: true,
          product: { select: { name: true } },
        },
      },
      reviews: { select: { productId: true } },
    },
  });
  if (!order || order.customerId !== userId) return [];

  const reviewed = new Set(order.reviews.map((r) => r.productId));
  return order.items
    .filter((item) => {
      if (reviewed.has(item.productId)) return false;
      const allowed =
        item.type === "RENT"
          ? (REVIEWABLE_RENTAL_STATUSES as readonly string[])
          : (REVIEWABLE_SALE_STATUSES as readonly string[]);
      return allowed.includes(order.status);
    })
    .map((item) => ({ productId: item.productId, name: item.product.name }));
}
