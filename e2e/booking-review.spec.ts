import { expect, test } from "@playwright/test";

import { createUser, db, seedPastConfirmedBooking, TEST_PASSWORD } from "./helpers/db";
import { login } from "./helpers/auth";

test("customer books the fixture provider, who accepts it", async ({ page, browser }) => {
  const customer = await createUser({
    email: `booker.${Date.now()}@e2e.test`,
    username: `booker${Date.now()}`,
    firstName: "Book",
    lastName: "Er",
  });
  const provider = await db.user.findUniqueOrThrow({ where: { username: "fixtureprovider" } });

  await login(page, customer.email, TEST_PASSWORD);
  await page.goto(`/booking/${provider.id}`);

  await page.getByRole("button", { name: "Portrait Session" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Jump the calendar a full cycle forward (28 days) to stay comfortably
  // clear of the 24h minimum-notice window without hardcoding a date.
  await page.getByRole("button", { name: "Next" }).click();
  await page.locator(".grid.grid-cols-7 button:not([disabled])").first().click();
  await page.locator("text=/^\\d{2}:\\d{2}$/").first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "At provider's studio" }).check();
  await page.getByLabel("Number of people").fill("2");
  await page.getByLabel("Contact phone").fill("0900000000");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("checkbox", { name: "I agree to the booking terms" }).check();
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(page.getByText("Booking request sent!")).toBeVisible({ timeout: 15_000 });

  const booking = await db.booking.findFirstOrThrow({
    where: { customerId: customer.id, providerId: provider.id },
    orderBy: { createdAt: "desc" },
  });
  expect(booking.status).toBe("PENDING");

  const providerContext = await browser.newContext();
  const providerPage = await providerContext.newPage();
  await login(providerPage, "fixture-provider@e2e.test", TEST_PASSWORD);
  await providerPage.goto(`/dashboard/bookings/${booking.id}`);
  await providerPage.getByRole("button", { name: "Accept" }).click();
  await providerPage.getByRole("dialog").getByRole("button", { name: "Confirm booking" }).click();
  await expect(providerPage.getByText("Confirmed")).toBeVisible({ timeout: 10_000 });
  await providerContext.close();

  const updated = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
  expect(updated.status).toBe("CONFIRMED");
});

// The wizard enforces >=24h notice and "mark complete" requires a past
// date, so a booking can never be both created and completed through the
// UI in one run — this seeds a past CONFIRMED booking directly (see
// e2e/helpers/db.ts) to test the completion + review half in isolation.
test("provider marks a past booking complete, customer reviews it", async ({ page, browser }) => {
  const customer = await createUser({
    email: `reviewer.${Date.now()}@e2e.test`,
    username: `reviewer${Date.now()}`,
    firstName: "Review",
    lastName: "Er",
  });
  const provider = await db.user.findUniqueOrThrow({ where: { username: "fixtureprovider" } });
  const service = await db.service.findFirstOrThrow({ where: { profile: { userId: provider.id } } });

  const booking = await seedPastConfirmedBooking({
    customerId: customer.id,
    providerId: provider.id,
    serviceId: service.id,
    daysAgo: 3,
  });

  await login(page, "fixture-provider@e2e.test", TEST_PASSWORD);
  await page.goto(`/dashboard/bookings/${booking.id}`);
  // getByText("Completed") would match the "Mark completed" button's own
  // label (case-insensitive substring) before the click even happens —
  // scope to the status badge specifically, and wait for the button itself
  // to disappear (it only renders for CONFIRMED bookings).
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByRole("button", { name: "Mark completed" })).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('[data-slot="badge"]', { hasText: "Completed" })).toBeVisible();

  const completed = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.completedAt).not.toBeNull();

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await login(customerPage, customer.email, TEST_PASSWORD);
  await customerPage.goto(`/review/${booking.id}`);
  await customerPage.getByRole("button", { name: "5 stars" }).click();
  await customerPage
    .getByPlaceholder("What did you like? What could be better?")
    .fill("Fantastic session, on time and very professional. Would book again.");
  // A text-based success assertion here matched the page's own static
  // heading immediately and raced ahead of the actual POST, closing the
  // context before it finished (same class of bug as the profile-save
  // race in provider-onboarding.spec.ts) — wait on the response itself.
  await Promise.all([
    customerPage.waitForResponse(
      (res) => res.url().includes("/api/reviews") && res.request().method() === "POST",
    ),
    customerPage.getByRole("button", { name: "Submit review" }).click(),
  ]);
  await customerContext.close();

  const review = await db.review.findUniqueOrThrow({ where: { bookingId: booking.id } });
  expect(review.rating).toBe(5);
  expect(review.reviewerId).toBe(customer.id);
});
