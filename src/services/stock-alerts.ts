import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { notify } from "@/services/notification";

// "Báo cho tôi khi có hàng" (wave 2 Chợ F). A customer asks once on an
// out-of-stock listing; when its stock comes back the request is answered
// with one in-app notification and marked notified, so a later restock
// does not nag again unless they ask again.

export class StockAlertError extends Error {
  constructor(
    message: string,
    public status: 400 | 404,
  ) {
    super(message);
    this.name = "StockAlertError";
  }
}

export async function hasStockAlert(userId: string, productId: string) {
  const alert = await db.stockAlert.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { notifiedAt: true },
  });
  return Boolean(alert && !alert.notifiedAt);
}

/** Turns the request on (asking again re-arms it) or off. */
export async function setStockAlert(
  userId: string,
  productId: string,
  on: boolean,
) {
  if (!on) {
    await db.stockAlert.deleteMany({ where: { userId, productId } });
    return { active: false };
  }
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { userId: true, isActive: true, deletedAt: true },
  });
  if (!product || !product.isActive || product.deletedAt) {
    throw new StockAlertError("Product not found", 404);
  }
  if (product.userId === userId) {
    throw new StockAlertError("You can't follow your own listing", 400);
  }
  await db.stockAlert.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: { notifiedAt: null },
  });
  return { active: true };
}

/**
 * Called after anything that can raise a product's stock (the seller's
 * edit, a cancelled order returning items). Does nothing unless the
 * listing is live and in stock; safe to call more than once.
 */
export async function notifyBackInStock(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { name: true, stock: true, isActive: true, deletedAt: true },
  });
  if (!product || !product.isActive || product.deletedAt) return 0;
  if (product.stock <= 0) return 0;

  const alerts = await db.stockAlert.findMany({
    where: { productId, notifiedAt: null },
    select: { id: true, userId: true },
  });
  if (alerts.length === 0) return 0;

  // System-triggered, no request locale: Vietnamese (CLAUDE.md rule 10).
  const nt = await getTranslations({
    locale: "vi",
    namespace: "libServices.notifications.stock",
  });
  for (const alert of alerts) {
    // Claim the row first, so two restocks racing never notify twice.
    const claimed = await db.stockAlert.updateMany({
      where: { id: alert.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    if (claimed.count === 0) continue;
    await notify({
      userId: alert.userId,
      type: "PRODUCT_BACK_IN_STOCK",
      title: nt("title"),
      message: nt("message", { product: product.name }),
      data: { productId },
    });
  }
  return alerts.length;
}
