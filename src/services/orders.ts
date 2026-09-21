import type { OrderStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import type Stripe from "stripe";

import { SELLER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  ACTIVE_RENTAL_STATUSES,
  checkOrderTransition,
  ORDER_STATUS_LABEL as STATUS_LABEL,
} from "@/lib/order-status";
import { calculateRentalDays, resolveDeliveryFee } from "@/lib/pricing";
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
    public status: 400 | 403 | 404 | 409,
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

// Called from the checkout.session.completed webhook. Kept for the Stripe
// path, which is dormant (CLAUDE.md rule 1) — the live flow is
// placeOrdersFromCart below.
export async function createOrdersFromCheckout(
  session: Stripe.Checkout.Session,
) {
  const userId = session.metadata?.userId;
  if (!userId || session.metadata?.orderType !== "marketplace") return [];

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

  return createOrdersForCart(userId, {
    deliveryMethod:
      session.metadata?.deliveryMethod === "SHIP" ? "SHIP" : "PICKUP",
    shippingAddress,
    stripePaymentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null,
  });
}

/**
 * Turns the customer's cart into one order per shop. Money is settled
 * between the customer and the shop directly (project owner, 21/09/2026:
 * the shop collects the rental deposit itself for MVP), so nothing here
 * charges a card — the order records what was agreed and both sides get
 * notified.
 */
async function createOrdersForCart(
  userId: string,
  options: {
    deliveryMethod: "SHIP" | "PICKUP";
    shippingAddress: string | null;
    stripePaymentId: string | null;
  },
) {
  const { deliveryMethod, shippingAddress } = options;

  const cart = await db.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
  if (cart.length === 0) return [];

  const byShop = new Map<string, typeof cart>();
  for (const item of cart) {
    const list = byShop.get(item.product.userId) ?? [];
    list.push(item);
    byShop.set(item.product.userId, list);
  }

  const customer = await db.user.findUnique({ where: { id: userId } });

  // One lookup for every shop in the cart rather than one per order.
  const shopProfiles = await db.profile.findMany({
    where: { userId: { in: [...byShop.keys()] }, role: { in: SELLER_ROLES } },
    select: { userId: true, deliveryFee: true },
  });
  const deliveryFeeByShop = new Map(
    shopProfiles.map((profile) => [profile.userId, profile.deliveryFee]),
  );

  const orders = [];

  for (const [shopId, items] of byShop) {
    const currency = items[0].product.currency;
    let totalPrice = 0;

    const delivery = resolveDeliveryFee(
      deliveryMethod,
      deliveryFeeByShop.get(shopId),
    );
    if (!delivery.ok) {
      throw new OrderError(
        "This shop does not deliver — choose collection at the shop instead",
        409,
      );
    }
    totalPrice += delivery.fee;

    const orderItemsData = items.map((item) => {
      const unitPrice =
        item.type === "RENT"
          ? (item.product.rentalPrice ?? 0)
          : (item.product.price ?? 0);
      const days =
        item.type === "RENT" && item.rentalStart && item.rentalEnd
          ? Math.max(1, calculateRentalDays(item.rentalStart, item.rentalEnd))
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
        // The shop collects the deposit in person, so the platform never
        // holds it; the amount is recorded for both sides to agree on.
        depositStatus: null,
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
          deliveryFee: delivery.fee,
          stripePaymentId: options.stripePaymentId,
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

/**
 * Rejects a rental whose dates overlap one the same item already has. Two
 * customers renting the same dress on the same weekend is the failure this
 * marketplace cannot ship without.
 */
export async function findRentalConflicts(
  items: {
    productId: string;
    rentalStart: Date | null;
    rentalEnd: Date | null;
  }[],
) {
  const rentals = items.filter(
    (item) => item.rentalStart != null && item.rentalEnd != null,
  );
  if (rentals.length === 0) return [];

  const clashing = await db.orderItem.findMany({
    where: {
      productId: { in: rentals.map((item) => item.productId) },
      type: "RENT",
      order: { status: { in: ACTIVE_RENTAL_STATUSES } },
    },
    select: {
      productId: true,
      rentalStart: true,
      rentalEnd: true,
      product: { select: { name: true } },
    },
  });

  const conflicts: { productId: string; productName: string }[] = [];
  for (const wanted of rentals) {
    const clash = clashing.find(
      (taken) =>
        taken.productId === wanted.productId &&
        taken.rentalStart != null &&
        taken.rentalEnd != null &&
        // Half-open ranges: returning on the day the next rental starts is
        // fine, overlapping by a day is not.
        wanted.rentalStart! < taken.rentalEnd &&
        taken.rentalStart < wanted.rentalEnd!,
    );
    if (clash) {
      conflicts.push({
        productId: wanted.productId,
        productName: clash.product.name,
      });
    }
  }
  return conflicts;
}

/**
 * The live "place order" path: no payment provider involved. The customer
 * confirms what they want, each shop gets an order to accept, and payment
 * (including any rental deposit) happens between them — on delivery, on
 * pickup, or by transfer. See docs/guides/phase-13-marketplace-social.md.
 */
export async function placeOrdersFromCart(
  userId: string,
  options: {
    deliveryMethod: "SHIP" | "PICKUP";
    shippingAddress?: string | null;
  },
) {
  const cart = await db.cartItem.findMany({
    where: { userId },
    include: { product: { select: { name: true, stock: true } } },
  });
  if (cart.length === 0) throw new OrderError("Your cart is empty", 400);

  if (options.deliveryMethod === "SHIP" && !options.shippingAddress?.trim()) {
    throw new OrderError("A delivery address is required", 400);
  }

  const outOfStock = cart.find(
    (item) => item.type === "SALE" && item.product.stock < item.quantity,
  );
  if (outOfStock) {
    throw new OrderError(`${outOfStock.product.name} is out of stock`, 409);
  }

  const conflicts = await findRentalConflicts(cart);
  if (conflicts.length > 0) {
    throw new OrderError(
      `${conflicts[0].productName} is already rented for those dates`,
      409,
    );
  }

  return createOrdersForCart(userId, {
    deliveryMethod: options.deliveryMethod,
    shippingAddress: options.shippingAddress?.trim() || null,
    stripePaymentId: null,
  });
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

/**
 * When a collection order reveals the shop's exact street address to its
 * customer. Profile.address is private, and a pending order is just
 * somebody's cart — the address opens up once the shop has accepted the
 * order and the customer genuinely has to travel to it (project owner,
 * 21/09/2026). Deliberately excludes PENDING and CANCELLED.
 */
const PICKUP_ADDRESS_VISIBLE_IN: OrderStatus[] = [
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "PICKED_UP",
  "OVERDUE",
  "RETURNED",
];

export async function getOrderDetail(orderId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!order || (order.customerId !== userId && order.shopId !== userId))
    return null;

  // Fetched separately rather than through ORDER_INCLUDE, which listOrders
  // also uses — an address must not ride along in a list response.
  const pickupAddress =
    order.deliveryMethod === "PICKUP" &&
    PICKUP_ADDRESS_VISIBLE_IN.includes(order.status)
      ? await shopPickupAddress(order.shopId)
      : null;

  return { ...order, pickupAddress };
}

async function shopPickupAddress(shopId: string) {
  const profile = await db.profile.findFirst({
    where: { userId: shopId, role: { in: SELLER_ROLES } },
    select: {
      address: true,
      ward: { select: { name: true } },
      province: { select: { name: true } },
    },
  });
  if (!profile) return null;
  return (
    [profile.address, profile.ward?.name, profile.province?.name]
      .filter(Boolean)
      .join(", ") || null
  );
}

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

  const transition = checkOrderTransition(
    order.status,
    status,
    order.items.some((item) => item.type === "RENT"),
  );
  if (!transition.ok) throw new OrderError(transition.reason, 409);

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
  fees?: { lateFeeAmount?: number; damageFeeAmount?: number },
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  if (!order || order.shopId !== userId)
    throw new OrderError("Order not found", 404);

  const transition = checkOrderTransition(
    order.status,
    "RETURNED",
    order.items.some((item) => item.type === "RENT"),
  );
  if (!transition.ok) throw new OrderError(transition.reason, 409);

  const returnedAt = new Date();

  await db.orderItem.updateMany({
    where: { orderId, type: "RENT" },
    data: {
      returnedAt,
      // The deposit is held by the shop, not the platform (project owner,
      // 21/09/2026) — this records what the shop says it did with it.
      depositStatus: deductDeposit ? "DEDUCTED" : "REFUNDED",
    },
  });

  await db.order.update({
    where: { id: orderId },
    data: {
      status: "RETURNED",
      lateFeeAmount: fees?.lateFeeAmount ?? null,
      damageFeeAmount: fees?.damageFeeAmount ?? null,
      returnNote: note ?? null,
    },
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

/**
 * Flags rentals whose window has passed while the item is still out. Only the
 * cron calls this — a shop never clicks "overdue", the same way nobody clicks
 * "expired" on a booking. Returns how many orders were flagged.
 */
export async function flagOverdueRentals(now = new Date()) {
  const candidates = await db.order.findMany({
    where: {
      status: { in: ["DELIVERED", "PICKED_UP"] },
      items: {
        some: { type: "RENT", returnedAt: null, rentalEnd: { lt: now } },
      },
    },
    select: { id: true },
  });

  if (candidates.length === 0) return 0;

  const { count } = await db.order.updateMany({
    where: { id: { in: candidates.map((order) => order.id) } },
    data: { status: "OVERDUE" },
  });

  for (const order of candidates) {
    const detail = await db.order.findUnique({
      where: { id: order.id },
      select: { customerId: true },
    });
    if (!detail) continue;
    await notify({
      userId: detail.customerId,
      type: "ORDER_DELIVERED",
      title: "Rental overdue",
      message: `Order #${order.id.slice(-8)} is past its return date. Please contact the shop to return it.`,
      data: { orderId: order.id },
    });
  }

  return count;
}

/**
 * Reminds customers the day before a rental is due back. Runs daily from
 * /api/cron/rental-return-reminders, which is also why the window is a whole
 * calendar day rather than "24 hours from now": a cron that slips by a few
 * minutes must not skip somebody's reminder.
 */
export async function sendRentalReturnReminders(now = new Date()) {
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const endOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2,
  );

  const orders = await db.order.findMany({
    where: {
      status: { in: ["DELIVERED", "PICKED_UP"] },
      items: {
        some: {
          type: "RENT",
          returnedAt: null,
          rentalEnd: { gte: startOfTomorrow, lt: endOfTomorrow },
        },
      },
    },
    select: { id: true, customerId: true },
  });

  for (const order of orders) {
    await notify({
      userId: order.customerId,
      type: "ORDER_DELIVERED",
      title: "Rental due back tomorrow",
      message: `Order #${order.id.slice(-8)} is due back tomorrow. Contact the shop to arrange the return.`,
      data: { orderId: order.id },
    });
  }

  return orders.length;
}
