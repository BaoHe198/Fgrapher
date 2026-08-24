import type { OrderStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import type Stripe from "stripe";

import { db } from "@/lib/db";
import {
  newOrderEmailHtml,
  orderConfirmationEmailHtml,
  orderStatusEmailHtml,
} from "@/lib/email";
import { createOrderCheckoutSession, refundPayment } from "@/lib/stripe";
import { notify } from "@/services/notification";

const PAGE_SIZE = 20;

function orderUrlFor(orderId: string) {
  return `${process.env.NEXTAUTH_URL ?? ""}/dashboard/orders/${orderId}`;
}

function partyName(party: { firstName: string | null; name: string | null }) {
  return party.firstName ?? party.name ?? "there";
}

export class OrderError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export async function createCheckoutSessionForCart(
  userId: string,
  deliveryMethod: "SHIP" | "PICKUP",
) {
  const cart = await db.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
  if (cart.length === 0) throw new OrderError("Your cart is empty", 400);

  const customer = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const currency = cart[0].product.currency;

  const lineItems = cart.map((item) => {
    const unitPrice =
      item.type === "RENT"
        ? (item.product.rentalPrice ?? 0)
        : (item.product.price ?? 0);
    const days =
      item.type === "RENT" && item.rentalStart && item.rentalEnd
        ? Math.max(
            1,
            Math.round(
              (item.rentalEnd.getTime() - item.rentalStart.getTime()) /
                86_400_000,
            ),
          )
        : 1;
    const amount = item.type === "RENT" ? unitPrice * days : unitPrice;
    return {
      name:
        item.type === "RENT"
          ? `${item.product.name} (rental, ${days}d)`
          : item.product.name,
      amount:
        amount + (item.type === "RENT" ? (item.product.depositAmount ?? 0) : 0),
      currency,
      quantity: item.quantity,
    };
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "";
  const session = await createOrderCheckoutSession({
    customerEmail: customer.email,
    lineItems,
    metadata: { userId, orderType: "marketplace", deliveryMethod },
    successUrl: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/cart?checkout=cancelled`,
    collectShippingAddress: deliveryMethod === "SHIP",
  });

  return session;
}

// Called from the checkout.session.completed webhook — orders are created
// fresh from the live cart at payment-completion time (not pre-created at
// checkout start) so an abandoned checkout never leaves an orphaned order.
export async function createOrdersFromCheckout(
  session: Stripe.Checkout.Session,
) {
  const userId = session.metadata?.userId;
  if (!userId || session.metadata?.orderType !== "marketplace") return [];

  const cart = await db.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
  if (cart.length === 0) return [];

  const deliveryMethod = session.metadata?.deliveryMethod ?? "PICKUP";
  const shippingAddress = session.customer_details?.address
    ? [
        session.customer_details.address.line1,
        session.customer_details.address.line2,
        session.customer_details.address.city,
        session.customer_details.address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const byShop = new Map<string, typeof cart>();
  for (const item of cart) {
    const list = byShop.get(item.product.userId) ?? [];
    list.push(item);
    byShop.set(item.product.userId, list);
  }

  const customer = await db.user.findUnique({ where: { id: userId } });
  const orders = [];

  for (const [shopId, items] of byShop) {
    const currency = items[0].product.currency;
    let totalPrice = 0;

    const orderItemsData = items.map((item) => {
      const unitPrice =
        item.type === "RENT"
          ? (item.product.rentalPrice ?? 0)
          : (item.product.price ?? 0);
      const days =
        item.type === "RENT" && item.rentalStart && item.rentalEnd
          ? Math.max(
              1,
              Math.round(
                (item.rentalEnd.getTime() - item.rentalStart.getTime()) /
                  86_400_000,
              ),
            )
          : 1;
      const lineTotal =
        (item.type === "RENT" ? unitPrice * days : unitPrice) * item.quantity;
      totalPrice +=
        lineTotal +
        (item.type === "RENT" ? (item.product.depositAmount ?? 0) : 0);

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        type: item.type,
        rentalStart: item.rentalStart,
        rentalEnd: item.rentalEnd,
        depositAmount: item.type === "RENT" ? item.product.depositAmount : null,
        depositStatus:
          item.type === "RENT" && item.product.depositAmount
            ? ("HELD" as const)
            : null,
      };
    });

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId: userId,
          shopId,
          totalPrice,
          currency,
          deliveryMethod,
          shippingAddress,
          stripePaymentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          items: { create: orderItemsData },
        },
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      });

      for (const item of items) {
        if (item.type === "SALE") {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      return created;
    });

    orders.push(order);

    const itemsSummary = order.items
      .map((i) => `${i.product.name} x${i.quantity}`)
      .join(", ");
    const orderNumber = order.id.slice(-8);
    // Stripe-webhook-triggered — no request/cookie context to resolve a
    // locale from, so this explicitly defaults to Vietnamese (CLAUDE.md
    // rule 10), matching services/bookings.ts's cron/system-actor branches.
    const emailT = await getTranslations({
      locale: "vi",
      namespace: "libServices.email",
    });

    await notify({
      userId: shopId,
      type: "NEW_ORDER",
      title: "New order received",
      message: `${customer ? partyName(customer) : "A customer"} placed an order — ${itemsSummary}`,
      data: { orderId: order.id },
      email: {
        subject: `New order #${orderNumber} — Fgrapher`,
        html: newOrderEmailHtml({
          t: emailT,
          orderNumber,
          customerName: customer ? partyName(customer) : "A customer",
          itemsSummary,
          orderUrl: orderUrlFor(order.id),
        }),
      },
    });

    if (customer) {
      await notify({
        userId: customer.id,
        type: "NEW_ORDER",
        title: "Order confirmed!",
        message: `Order #${orderNumber} — ${itemsSummary}`,
        data: { orderId: order.id },
        email: {
          subject: `Order confirmed #${orderNumber} — Fgrapher`,
          html: orderConfirmationEmailHtml({
            t: emailT,
            orderNumber,
            itemsSummary,
            totalLabel: `${totalPrice} ${currency}`,
            orderUrl: orderUrlFor(order.id),
          }),
        },
      });
    }
  }

  await db.cartItem.deleteMany({ where: { userId } });

  return orders;
}

const ORDER_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      firstName: true,
      avatar: true,
      email: true,
    },
  },
  shop: {
    select: {
      id: true,
      name: true,
      firstName: true,
      avatar: true,
      email: true,
    },
  },
  items: {
    include: {
      product: {
        include: { images: { orderBy: { order: "asc" as const }, take: 1 } },
      },
    },
  },
} as const;

export async function listOrders({
  userId,
  role,
  status,
  page,
}: {
  userId: string;
  role: "customer" | "shop";
  status?: OrderStatus;
  page: number;
}) {
  const where = {
    ...(role === "customer" ? { customerId: userId } : { shopId: userId }),
    ...(status ? { status } : {}),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: ORDER_INCLUDE,
    }),
    db.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getOrderDetail(orderId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!order || (order.customerId !== userId && order.shopId !== userId))
    return null;
  return order;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURNED: "returned",
};

const NOTIFICATION_TYPE_FOR_STATUS: Partial<
  Record<
    OrderStatus,
    "ORDER_CONFIRMED" | "ORDER_SHIPPED" | "ORDER_DELIVERED" | "ORDER_CANCELLED"
  >
> = {
  CONFIRMED: "ORDER_CONFIRMED",
  SHIPPED: "ORDER_SHIPPED",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
};

export async function updateOrderStatus({
  orderId,
  userId,
  status,
  trackingNumber,
  trackingCarrier,
  cancelReason,
}: {
  orderId: string;
  userId: string;
  status: OrderStatus;
  trackingNumber?: string;
  trackingCarrier?: string;
  cancelReason?: string;
}) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!order) throw new OrderError("Order not found", 404);

  const isShop = order.shopId === userId;
  const isCustomer = order.customerId === userId;
  if (!isShop && !isCustomer)
    throw new OrderError("You are not part of this order", 403);
  if (status !== "CANCELLED" && !isShop) {
    throw new OrderError("Only the shop can update this order's status", 403);
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(trackingNumber ? { trackingNumber } : {}),
      ...(trackingCarrier ? { trackingCarrier } : {}),
      ...(status === "CANCELLED" ? { cancelReason } : {}),
    },
    include: ORDER_INCLUDE,
  });

  if (status === "CANCELLED") {
    // Restock SALE items that were decremented at order creation.
    for (const item of order.items) {
      if (item.type === "SALE") {
        await db.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    if (order.stripePaymentId) {
      await refundPayment(order.stripePaymentId).catch(() => {});
    }
  }

  const recipient = isShop ? order.customer : order.shop;
  const notificationType = NOTIFICATION_TYPE_FOR_STATUS[status];
  if (notificationType) {
    const orderNumber = order.id.slice(-8);
    const emailT = await getTranslations("libServices.email");
    await notify({
      userId: recipient.id,
      type: notificationType,
      title: `Order ${STATUS_LABEL[status]}`,
      message: `Order #${orderNumber} is now ${STATUS_LABEL[status]}${trackingNumber ? ` — tracking: ${trackingNumber}` : ""}`,
      data: { orderId: order.id },
      email: {
        subject: `Order ${STATUS_LABEL[status]} — Fgrapher`,
        html: orderStatusEmailHtml({
          t: emailT,
          orderNumber,
          statusLabel: STATUS_LABEL[status],
          detail: trackingNumber
            ? `Tracking: ${trackingCarrier ?? ""} ${trackingNumber}`
            : undefined,
          orderUrl: orderUrlFor(order.id),
        }),
      },
    });
  }

  return updated;
}

export async function markRentalReturned(
  orderId: string,
  userId: string,
  deductDeposit: boolean,
  note?: string,
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!order || order.shopId !== userId)
    throw new OrderError("Order not found", 404);

  await db.orderItem.updateMany({
    where: { orderId, type: "RENT" },
    data: { depositStatus: deductDeposit ? "DEDUCTED" : "REFUNDED" },
  });

  await db.order.update({
    where: { id: orderId },
    data: { status: "RETURNED" },
  });

  await notify({
    userId: order.customerId,
    type: "ORDER_DELIVERED",
    title: "Rental returned",
    message: deductDeposit
      ? `Your deposit was partially withheld. ${note ?? ""}`.trim()
      : "Your rental deposit has been refunded.",
    data: { orderId: order.id },
  });

  return order;
}
