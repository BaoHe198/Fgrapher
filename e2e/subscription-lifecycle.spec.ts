import { expect, test } from "@playwright/test";

import { activatePaidRole, createUser, db, TEST_PASSWORD } from "./helpers/db";
import { login } from "./helpers/auth";

// Cancel and resubscribe.
//
// billing-settings-content.tsx calls POST /api/stripe/cancel /
// /api/stripe/resume and then unconditionally reloads the page — it never
// inspects the response (confirmed by reading the component). Those routes
// call Stripe's subscriptions.update() for real, which throws
// StripeNotConfiguredError with no live key, and the actual DB write
// (Subscription.cancelAtPeriodEnd) only ever happens via the
// customer.subscription.updated webhook afterwards — not synchronously in
// the route handler. So with no Stripe credentials, clicking these buttons
// is a real, verifiable no-op today.
//
// This test verifies both things honestly: the button click sends the
// correct request (proving the UI is wired correctly), and it doesn't
// mislead itself into asserting a state change that can't actually happen
// here — the DB toggle is applied directly, standing in for what the
// webhook would do, exactly like the other Stripe-gated flows in this
// suite (see e2e/README.md).
test("cancel and resume subscription updates the UI once the state changes", async ({ page }) => {
  const user = await createUser({
    email: `sub.${Date.now()}@e2e.test`,
    username: `sub${Date.now()}`,
    firstName: "Sub",
    lastName: "Scriber",
    roles: ["PHOTOGRAPHER"],
  });
  const subscription = await activatePaidRole(user.id, "PHOTOGRAPHER");

  let cancelRequestBody: unknown = null;
  await page.route("**/api/stripe/cancel", async (route) => {
    cancelRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ data: null, error: "not_configured", message: "not configured" }),
    });
  });

  await login(page, user.email, TEST_PASSWORD);
  await page.goto("/dashboard/settings/billing");
  await page.getByRole("button", { name: "Cancel subscription" }).click();
  // window.location.reload() doesn't change the URL, so waitForURL would
  // resolve instantly without actually waiting for it — wait on the load
  // event itself instead, or a later explicit page.reload() can collide
  // with this still-in-flight one and abort.
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("dialog").getByRole("button", { name: "Cancel subscription" }).click(),
  ]);

  expect(cancelRequestBody).toEqual({ role: "PHOTOGRAPHER" });
  // Confirms today's real gap: the reload happened, but nothing changed.
  const stillActive = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
  expect(stillActive.cancelAtPeriodEnd).toBe(false);
  await expect(page.getByRole("button", { name: "Cancel subscription" })).toBeVisible();

  // Apply what the webhook would have done, and confirm the UI reacts
  // correctly to that state once it's actually true.
  await db.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true } });
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume subscription" })).toBeVisible();

  let resumeRequestBody: unknown = null;
  await page.route("**/api/stripe/resume", async (route) => {
    resumeRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ data: null, error: "not_configured", message: "not configured" }),
    });
  });
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Resume subscription" }).click(),
  ]);
  expect(resumeRequestBody).toEqual({ role: "PHOTOGRAPHER" });

  await db.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: false } });
  await page.reload();
  await expect(page.getByRole("button", { name: "Cancel subscription" })).toBeVisible();
});
