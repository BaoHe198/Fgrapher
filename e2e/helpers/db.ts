import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

// Dedicated client for test-fixture setup/teardown — same DATABASE_URL the
// app under test uses (see e2e/global-setup.ts and .env.test.example),
// never the dev database. check-db-safety.mjs's allow-list only guards the
// `db:*` npm scripts, not this file, so it's on whoever runs the suite to
// point .env.test at a disposable database (see e2e/README.md).
export const db = new PrismaClient();

export const TEST_PASSWORD = "Test1234!";

export async function createUser(opts: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles?: Role[];
  location?: string;
}) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4); // low cost factor — speed, not security, in tests
  const user = await db.user.create({
    data: {
      email: opts.email,
      username: opts.username,
      firstName: opts.firstName,
      lastName: opts.lastName,
      name: `${opts.firstName} ${opts.lastName}`,
      location: opts.location,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  for (const role of opts.roles ?? []) {
    await db.userRole.create({ data: { userId: user.id, role, active: true } });
  }

  return user;
}

// Mirrors prisma/seed.ts's synthetic-subscription pattern: requirePaidRole/
// requireActiveSubscription need a real ACTIVE Subscription row, which only
// a live Stripe checkout+webhook would otherwise produce.
export async function activatePaidRole(userId: string, role: Role) {
  const userRole = await db.userRole.upsert({
    where: { userId_role: { userId, role } },
    create: { userId, role, active: true },
    update: { active: true },
  });

  return db.subscription.upsert({
    where: { userRoleId: userRole.id },
    create: {
      userRoleId: userRole.id,
      plan: role,
      status: "ACTIVE",
      interval: "month",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    },
    update: { status: "ACTIVE", cancelAtPeriodEnd: false },
  });
}

// Mon-Fri 09:00-17:00, matching prisma/seed.ts's WEEKDAYS pattern. Without
// this, a provider has zero bookable slots regardless of anything else
// being set up correctly — Availability is keyed by userId, not profileId.
export async function seedWeekdayAvailability(userId: string) {
  const WEEKDAYS = [1, 2, 3, 4, 5];
  await db.availability.createMany({
    data: WEEKDAYS.map((dayOfWeek) => ({
      userId,
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
    })),
  });
}

export async function createPublishedProfile(opts: {
  userId: string;
  role: Role;
  displayName: string;
  description?: string;
  priceMin?: number;
  priceMax?: number;
  services?: { name: string; description: string; duration: number; price: number }[];
}) {
  // There's no UI path that sets Profile.isPublished (see e2e/README.md) —
  // this fixture stands in for what a real admin/ops process would do.
  const profile = await db.profile.create({
    data: {
      userId: opts.userId,
      role: opts.role,
      displayName: opts.displayName,
      description: opts.description ?? "E2E fixture profile.",
      priceMin: opts.priceMin ?? 500_000,
      priceMax: opts.priceMax ?? 5_000_000,
      currency: "VND",
      isPublished: true,
    },
  });

  for (const service of opts.services ?? []) {
    await db.service.create({
      data: {
        profileId: profile.id,
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        currency: "VND",
        isActive: true,
      },
    });
  }

  return profile;
}

export async function createProduct(opts: {
  userId: string;
  name: string;
  price: number;
  stock?: number;
}) {
  return db.product.create({
    data: {
      userId: opts.userId,
      name: opts.name,
      description: "E2E fixture product.",
      category: "camera",
      type: "SALE",
      price: opts.price,
      currency: "VND",
      condition: "NEW",
      stock: opts.stock ?? 5,
      isActive: true,
    },
  });
}

export async function getLatestVerificationToken(email: string) {
  return db.verificationToken.findFirst({
    where: { identifier: email },
    orderBy: { expires: "desc" },
  });
}

// The booking wizard enforces >=24h notice and "mark complete" requires a
// past date — the two facts together mean a booking can never be created
// AND completed through the UI in the same test run. This seeds a
// CONFIRMED booking dated in the past so the "complete -> review" half of
// the flow can be tested on its own.
export async function seedPastConfirmedBooking(opts: {
  customerId: string;
  providerId: string;
  serviceId?: string;
  daysAgo?: number;
}) {
  const date = new Date(Date.now() - (opts.daysAgo ?? 2) * 86_400_000);
  return db.booking.create({
    data: {
      customerId: opts.customerId,
      providerId: opts.providerId,
      serviceId: opts.serviceId,
      date,
      startTime: "14:00",
      endTime: "16:00",
      status: "CONFIRMED",
      locationType: "PROVIDER",
      totalPrice: 1_000_000,
      currency: "VND",
    },
  });
}

// Order rows are only ever created by the Stripe checkout.session.completed
// webhook (see e2e/README.md) — there is no direct-create path in the app
// at all, so fulfillment tests seed one directly rather than driving a real
// payment.
export async function seedPendingOrder(opts: {
  customerId: string;
  shopId: string;
  productId: string;
  quantity?: number;
  unitPrice: number;
}) {
  const quantity = opts.quantity ?? 1;
  return db.order.create({
    data: {
      customerId: opts.customerId,
      shopId: opts.shopId,
      status: "PENDING",
      deliveryMethod: "SHIP",
      totalPrice: opts.unitPrice * quantity,
      currency: "VND",
      items: {
        create: [{ productId: opts.productId, quantity, unitPrice: opts.unitPrice, type: "SALE" }],
      },
    },
    include: { items: true },
  });
}

export async function disconnect() {
  await db.$disconnect();
}
