import { expect, test } from "@playwright/test";

import { vietnamToInstant } from "../src/lib/calendar/agenda";

import { login } from "./helpers/auth";
import {
  createPublishedProfile,
  createUser,
  db,
  seedWeekdayAvailability,
  TEST_PASSWORD,
} from "./helpers/db";

// The work calendar (20/11/2026): a provider records a job taken outside
// Fgrapher, and those hours must close on their public profile exactly as a
// booking's do. As in blocked-dates.spec.ts these hit /api/bookings
// directly, to prove the service layer refuses the slot, not just the
// booking widget — and that the entry itself stays private to its owner.

function nextWeekday(dayOfWeek: number, weeksAhead = 2) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + weeksAhead * 7);
  while (date.getUTCDay() !== dayOfWeek) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

test("a provider's own calendar entry closes its hours and stays private", async ({
  page,
}) => {
  const timestamp = Date.now();
  const provider = await createUser({
    email: `entryprov.${timestamp}@e2e.test`,
    username: `entryprov${timestamp}`,
    firstName: "Entry",
    lastName: "Provider",
    roles: ["PHOTOGRAPHER"],
  });
  const profile = await createPublishedProfile({
    userId: provider.id,
    role: "PHOTOGRAPHER",
    displayName: "Calendar Entry Fixture",
  });
  await seedWeekdayAvailability(provider.id);
  const service = await db.service.create({
    data: {
      profileId: profile.id,
      kind: "PHOTOGRAPHY",
      name: "Portrait Session",
      description: "E2E fixture service.",
      duration: 60,
      price: 1_000_000,
      currency: "VND",
      isActive: true,
    },
  });

  const targetDate = nextWeekday(3); // a Wednesday, inside the Mon-Fri fixture availability
  const entry = await db.calendarEntry.create({
    data: {
      userId: provider.id,
      title: "Off-platform wedding",
      startAt: vietnamToInstant(targetDate, "13:00"),
      endAt: vietnamToInstant(targetDate, "15:00"),
      customerName: "Outside Client",
      customerPhone: "0900000001",
    },
  });

  const customer = await createUser({
    email: `entrycust.${timestamp}@e2e.test`,
    username: `entrycust${timestamp}`,
    firstName: "Customer",
    lastName: "Tester",
    roles: ["CUSTOMER"],
  });
  await login(page, customer.email, TEST_PASSWORD);

  const book = (startTime: string) =>
    page.request.post("/api/bookings", {
      data: {
        providerId: provider.id,
        serviceId: service.id,
        date: targetDate,
        startTime,
        locationType: "PROVIDER",
        contactPhone: "0900000000",
      },
    });

  // Inside the entry's hours: refused, and nothing is created.
  const inside = await book("14:00");
  expect(inside.ok()).toBe(false);
  expect(
    await db.booking.count({
      where: { providerId: provider.id, customerId: customer.id },
    }),
  ).toBe(0);

  // The public slot list agrees with the refusal.
  const availability = await page.request.get(
    `/api/availability/${provider.id}?from=${targetDate}&to=${targetDate}&serviceId=${service.id}`,
  );
  const day = (await availability.json()).data.dates[0] as {
    slots: { time: string; available: boolean }[];
  };
  const open = day.slots.filter((s) => s.available).map((s) => s.time);
  expect(open).not.toContain("13:00");
  expect(open).not.toContain("14:00");
  expect(open).toContain("15:00");

  // Right after it: fine.
  expect((await book("15:00")).status()).toBe(201);

  // The customer can neither read the provider's calendar nor touch the entry.
  expect(
    (
      await page.request.get(
        `/api/calendar?from=${targetDate}&to=${targetDate}`,
      )
    ).ok(),
  ).toBe(false);
  expect(
    (await page.request.delete(`/api/calendar/entries/${entry.id}`)).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(
        `/api/calendar/ics?kind=ENTRY&id=${entry.id}&date=${targetDate}`,
      )
    ).status(),
  ).toBe(404);
  expect(await db.calendarEntry.count({ where: { id: entry.id } })).toBe(1);
});
