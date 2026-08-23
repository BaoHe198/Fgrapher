import { expect, test } from "@playwright/test";

import {
  createUser,
  db,
  seedBooking,
  seedPastConfirmedBooking,
  TEST_PASSWORD,
} from "./helpers/db";
import { login } from "./helpers/auth";

// transitionBooking() (src/services/bookings.ts) is the sole write path for
// Booking.status: a VALID_TRANSITIONS state machine, permission checks, and
// an append-only BookingStatusHistory row per move. This suite exercises it
// directly — every legal move via whatever UI action triggers it, every
// illegal move/permission violation via the API (several, like acting on a
// booking that isn't yours, or re-transitioning out of a terminal state,
// have no UI affordance to click at all), and the one system-only
// transition (-> EXPIRED) via the hourly cron route.
//
// Uses page.request (Playwright's APIRequestContext bound to the page's own
// cookie jar) for the API-level checks — the rest of this suite drives
// everything through the UI, but there's no button for "PATCH a booking you
// don't own" to click.

async function fixtureProvider() {
  return db.user.findUniqueOrThrow({ where: { username: "fixtureprovider" } });
}

async function fixtureService() {
  return db.service.findFirstOrThrow({ where: { name: "Portrait Session" } });
}

test.describe("valid transitions", () => {
  test("provider accepts a pending booking (PENDING -> CONFIRMED)", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `accept.${Date.now()}@e2e.test`,
      username: `accept${Date.now()}`,
      firstName: "Accept",
      lastName: "Er",
    });
    const booking = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
    });

    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
    await page.goto(`/dashboard/bookings/${booking.id}`);
    await page.getByRole("button", { name: "Accept" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm booking" })
      .click();
    await expect(
      page.locator('[data-slot="badge"]', { hasText: "Confirmed" }),
    ).toBeVisible({
      timeout: 10_000,
    });

    const updated = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe("CONFIRMED");

    const history = await db.bookingStatusHistory.findMany({
      where: { bookingId: booking.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0].fromStatus).toBe("PENDING");
    expect(history[0].toStatus).toBe("CONFIRMED");
    expect(history[0].actorId).toBe(provider.id);
  });

  test("provider declines a pending booking (PENDING -> DECLINED)", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `decline.${Date.now()}@e2e.test`,
      username: `decline${Date.now()}`,
      firstName: "Decline",
      lastName: "Er",
    });
    const booking = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
    });

    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
    await page.goto(`/dashboard/bookings/${booking.id}`);
    await page.getByRole("button", { name: "Decline" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Decline booking" })
      .click();
    await expect(
      page.locator('[data-slot="badge"]', { hasText: "Declined" }),
    ).toBeVisible({
      timeout: 10_000,
    });

    const updated = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe("DECLINED");

    const history = await db.bookingStatusHistory.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    expect(history.toStatus).toBe("DECLINED");
    expect(history.actorId).toBe(provider.id);
  });

  test("customer cancels their own pending booking (PENDING -> CANCELLED)", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `pcancel.${Date.now()}@e2e.test`,
      username: `pcancel${Date.now()}`,
      firstName: "Pending",
      lastName: "Canceller",
    });
    const booking = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
    });

    await login(page, customer.email, TEST_PASSWORD);
    await page.goto(`/dashboard/bookings/${booking.id}`);
    await page.getByRole("button", { name: "Cancel request" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel booking" })
      .click();
    await expect(
      page.locator('[data-slot="badge"]', { hasText: "Cancelled" }),
    ).toBeVisible({
      timeout: 10_000,
    });

    const updated = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.cancelledBy).toBe(customer.id);
  });

  test("provider cancels a confirmed booking (CONFIRMED -> CANCELLED)", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `ccancel.${Date.now()}@e2e.test`,
      username: `ccancel${Date.now()}`,
      firstName: "Confirmed",
      lastName: "Canceller",
    });
    const booking = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
      status: "CONFIRMED",
    });

    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
    await page.goto(`/dashboard/bookings/${booking.id}`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel booking" })
      .click();
    await expect(
      page.locator('[data-slot="badge"]', { hasText: "Cancelled" }),
    ).toBeVisible({
      timeout: 10_000,
    });

    const updated = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.cancelledBy).toBe(provider.id);
  });

  test("provider marks a past confirmed booking complete (CONFIRMED -> COMPLETED)", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `complete.${Date.now()}@e2e.test`,
      username: `complete${Date.now()}`,
      firstName: "Complete",
      lastName: "Er",
    });
    const service = await fixtureService();
    const booking = await seedPastConfirmedBooking({
      customerId: customer.id,
      providerId: provider.id,
      serviceId: service.id,
      daysAgo: 2,
    });

    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
    await page.goto(`/dashboard/bookings/${booking.id}`);
    await page.getByRole("button", { name: "Mark completed" }).click();
    await expect(
      page.getByRole("button", { name: "Mark completed" }),
    ).toBeHidden({ timeout: 10_000 });
    await expect(
      page.locator('[data-slot="badge"]', { hasText: "Completed" }),
    ).toBeVisible();

    const updated = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe("COMPLETED");
    expect(updated.completedAt).not.toBeNull();
  });

  test("provider reports a no-show for a past confirmed booking (CONFIRMED -> NO_SHOW)", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `noshow.${Date.now()}@e2e.test`,
      username: `noshow${Date.now()}`,
      firstName: "No",
      lastName: "Show",
    });
    const service = await fixtureService();
    const booking = await seedPastConfirmedBooking({
      customerId: customer.id,
      providerId: provider.id,
      serviceId: service.id,
      daysAgo: 1,
    });

    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
    await page.goto(`/dashboard/bookings/${booking.id}`);
    await page.getByRole("button", { name: "Report no-show" }).click();
    await expect(
      page.locator('[data-slot="badge"]', { hasText: "No-show" }),
    ).toBeVisible({
      timeout: 10_000,
    });

    const updated = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe("NO_SHOW");
  });
});

test.describe("forbidden transitions and permission checks", () => {
  test("a booking in a terminal state rejects every further transition", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `terminal.${Date.now()}@e2e.test`,
      username: `terminal${Date.now()}`,
      firstName: "Terminal",
      lastName: "State",
    });

    const terminalStatuses = [
      "DECLINED",
      "CANCELLED",
      "COMPLETED",
      "NO_SHOW",
    ] as const;
    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);

    for (const status of terminalStatuses) {
      const booking = await seedBooking({
        customerId: customer.id,
        providerId: provider.id,
        status,
      });
      const res = await page.request.patch(`/api/bookings/${booking.id}`, {
        data: { status: "CONFIRMED" },
      });
      expect(res.status(), `${status} -> CONFIRMED should be rejected`).toBe(
        400,
      );

      const unchanged = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(unchanged.status).toBe(status);
    }
  });

  test("only the provider may accept, decline, complete, or report a booking", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `noperm.${Date.now()}@e2e.test`,
      username: `noperm${Date.now()}`,
      firstName: "No",
      lastName: "Perm",
    });

    await login(page, customer.email, TEST_PASSWORD);

    const pending = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
    });
    const confirmRes = await page.request.patch(`/api/bookings/${pending.id}`, {
      data: { status: "CONFIRMED" },
    });
    expect(confirmRes.status()).toBe(403);

    const declineRes = await page.request.patch(`/api/bookings/${pending.id}`, {
      data: { status: "DECLINED" },
    });
    expect(declineRes.status()).toBe(403);

    const confirmed = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
      status: "CONFIRMED",
      daysFromNow: -3,
    });
    const completeRes = await page.request.patch(
      `/api/bookings/${confirmed.id}`,
      {
        data: { status: "COMPLETED" },
      },
    );
    expect(completeRes.status()).toBe(403);

    const noShowRes = await page.request.patch(
      `/api/bookings/${confirmed.id}`,
      {
        data: { status: "NO_SHOW" },
      },
    );
    expect(noShowRes.status()).toBe(403);

    const stillPending = await db.booking.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(stillPending.status).toBe("PENDING");
    const stillConfirmed = await db.booking.findUniqueOrThrow({
      where: { id: confirmed.id },
    });
    expect(stillConfirmed.status).toBe("CONFIRMED");
  });

  test("a non-participant cannot act on someone else's booking", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `owner.${Date.now()}@e2e.test`,
      username: `owner${Date.now()}`,
      firstName: "Owner",
      lastName: "Er",
    });
    const bystander = await createUser({
      email: `bystander.${Date.now()}@e2e.test`,
      username: `bystander${Date.now()}`,
      firstName: "By",
      lastName: "Stander",
    });
    const booking = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
    });

    await login(page, bystander.email, TEST_PASSWORD);
    const res = await page.request.patch(`/api/bookings/${booking.id}`, {
      data: { status: "CANCELLED" },
    });
    expect(res.status()).toBe(403);

    const unchanged = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(unchanged.status).toBe("PENDING");
  });

  test("a booking cannot be marked completed or no-show before its date", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `early.${Date.now()}@e2e.test`,
      username: `early${Date.now()}`,
      firstName: "Too",
      lastName: "Early",
    });
    const future = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
      status: "CONFIRMED",
      daysFromNow: 10,
    });

    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
    const completeRes = await page.request.patch(`/api/bookings/${future.id}`, {
      data: { status: "COMPLETED" },
    });
    expect(completeRes.status()).toBe(400);

    const noShowRes = await page.request.patch(`/api/bookings/${future.id}`, {
      data: { status: "NO_SHOW" },
    });
    expect(noShowRes.status()).toBe(400);

    const unchanged = await db.booking.findUniqueOrThrow({
      where: { id: future.id },
    });
    expect(unchanged.status).toBe("CONFIRMED");
  });

  test("EXPIRED can only be set by the system, never a human actor", async ({
    page,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `humanexp.${Date.now()}@e2e.test`,
      username: `humanexp${Date.now()}`,
      firstName: "Human",
      lastName: "Expirer",
    });
    const booking = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
    });

    // Neither party — provider or customer — can drive this transition
    // themselves; updateBookingStatusSchema excludes EXPIRED from the
    // human-facing enum entirely, so this is rejected at request validation
    // before transitionBooking's own actor check ever runs.
    await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
    const res = await page.request.patch(`/api/bookings/${booking.id}`, {
      data: { status: "EXPIRED" },
    });
    expect(res.status()).toBe(400);

    const unchanged = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(unchanged.status).toBe("PENDING");
  });
});

test.describe("auto-expiry", () => {
  test("the hourly cron expires overdue pending bookings and notifies both parties", async ({
    request,
  }) => {
    const provider = await fixtureProvider();
    const customer = await createUser({
      email: `autoexp.${Date.now()}@e2e.test`,
      username: `autoexp${Date.now()}`,
      firstName: "Auto",
      lastName: "Expire",
    });

    const overdue = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
      expiresAt: new Date(Date.now() - 60_000),
    });
    // A second, not-yet-overdue booking makes sure the cron is selective —
    // it should only touch bookings whose expiresAt has actually passed.
    const notYetDue = await seedBooking({
      customerId: customer.id,
      providerId: provider.id,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const res = await request.get("/api/cron/expire-bookings");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.expiredCount).toBeGreaterThanOrEqual(1);

    const expired = await db.booking.findUniqueOrThrow({
      where: { id: overdue.id },
    });
    expect(expired.status).toBe("EXPIRED");

    const stillPending = await db.booking.findUniqueOrThrow({
      where: { id: notYetDue.id },
    });
    expect(stillPending.status).toBe("PENDING");

    const history = await db.bookingStatusHistory.findFirstOrThrow({
      where: { bookingId: overdue.id, toStatus: "EXPIRED" },
    });
    expect(history.fromStatus).toBe("PENDING");
    expect(history.actorId).toBeNull();

    const customerNotified = await db.notification.findFirst({
      where: {
        userId: customer.id,
        type: "BOOKING_CANCELLED",
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    });
    const providerNotified = await db.notification.findFirst({
      where: {
        userId: provider.id,
        type: "BOOKING_CANCELLED",
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    });
    expect(customerNotified).not.toBeNull();
    expect(providerNotified).not.toBeNull();
  });
});
