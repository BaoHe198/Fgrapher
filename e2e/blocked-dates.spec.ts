import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import {
  createPublishedProfile,
  createUser,
  db,
  seedWeekdayAvailability,
  TEST_PASSWORD,
} from "./helpers/db";

// Prompt F3 (docs/guides/fgrapher-prompt-sua-loi-mvp_1.md) — manual busy-date
// blocking. The important bug this closes: createBooking() previously only
// checked for overlapping Bookings, never BlockedDate or the weekly
// Availability table — so a direct API call could book a date/time the
// booking widget itself would have greyed out. These tests hit
// /api/bookings directly (bypassing the widget) to prove the service layer
// itself now rejects it, not just the UI.

function nextWeekday(dayOfWeek: number, weeksAhead = 2) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + weeksAhead * 7);
  while (date.getUTCDay() !== dayOfWeek) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

test("a whole-day blocked date can't be booked via direct API call", async ({
  page,
}) => {
  const timestamp = Date.now();
  const provider = await createUser({
    email: `blockprov.${timestamp}@e2e.test`,
    username: `blockprov${timestamp}`,
    firstName: "Blocking",
    lastName: "Provider",
    roles: ["PHOTOGRAPHER"],
  });
  await seedWeekdayAvailability(provider.id);
  const profile = await createPublishedProfile({
    userId: provider.id,
    role: "PHOTOGRAPHER",
    displayName: "Blocked Date Fixture",
  });
  const service = await db.service.create({
    data: {
      profileId: profile.id,
      name: "Portrait Session",
      description: "E2E fixture service.",
      duration: 60,
      price: 1_000_000,
      currency: "VND",
      isActive: true,
    },
  });

  const targetDate = nextWeekday(2); // a Tuesday, inside the Mon-Fri fixture availability
  await db.blockedDate.create({
    data: {
      userId: provider.id,
      date: new Date(`${targetDate}T00:00:00.000Z`),
    },
  });

  const customer = await createUser({
    email: `blockcust.${timestamp}@e2e.test`,
    username: `blockcust${timestamp}`,
    firstName: "Customer",
    lastName: "Tester",
    roles: ["CUSTOMER"],
  });
  await login(page, customer.email, TEST_PASSWORD);

  const response = await page.request.post("/api/bookings", {
    data: {
      providerId: provider.id,
      serviceId: service.id,
      date: targetDate,
      startTime: "10:00",
      locationType: "PROVIDER",
      contactPhone: "0900000000",
    },
  });

  expect(response.ok()).toBe(false);
  const body = await response.json();
  expect(body.error).toBeTruthy();

  const bookingCount = await db.booking.count({
    where: {
      providerId: provider.id,
      date: new Date(`${targetDate}T00:00:00.000Z`),
    },
  });
  expect(bookingCount).toBe(0);
});

test("provider can't block a date that already has a CONFIRMED booking", async ({
  page,
}) => {
  const timestamp = Date.now();
  const provider = await createUser({
    email: `confprov.${timestamp}@e2e.test`,
    username: `confprov${timestamp}`,
    firstName: "Confirmed",
    lastName: "Provider",
    roles: ["PHOTOGRAPHER"],
  });
  const customer = await createUser({
    email: `confcust.${timestamp}@e2e.test`,
    username: `confcust${timestamp}`,
    firstName: "Confirmed",
    lastName: "Customer",
    roles: ["CUSTOMER"],
  });

  const targetDate = nextWeekday(3, 3);
  const booking = await db.booking.create({
    data: {
      customerId: customer.id,
      providerId: provider.id,
      date: new Date(`${targetDate}T00:00:00.000Z`),
      startTime: "14:00",
      endTime: "16:00",
      status: "CONFIRMED",
      locationType: "PROVIDER",
      contactPhone: "0900000000",
      totalPrice: 1_000_000,
      currency: "VND",
    },
  });

  await login(page, provider.email, TEST_PASSWORD);

  const response = await page.request.post("/api/blocked-dates", {
    data: { date: targetDate },
  });

  expect(response.status()).toBe(409);

  const blocked = await db.blockedDate.findUnique({
    where: {
      userId_date: {
        userId: provider.id,
        date: new Date(`${targetDate}T00:00:00.000Z`),
      },
    },
  });
  expect(blocked).toBeNull();

  // Cleanup isn't strictly required (each run uses fresh timestamped
  // fixtures), but confirms the booking itself was left untouched.
  const stillConfirmed = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
  });
  expect(stillConfirmed.status).toBe("CONFIRMED");
});
