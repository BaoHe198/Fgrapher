import { expect, test } from "@playwright/test";

import { createUser, db, seedPendingOrder, TEST_PASSWORD } from "./helpers/db";
import { login } from "./helpers/auth";

// Customer buys a product -> shop fulfills -> order completes.
//
// Online payment is off (CLAUDE.md: no Stripe, and the local rails are
// flag-gated). Checkout therefore places the order directly and the shop
// collects payment on delivery or at collection — so the first test drives
// the real UI all the way to an order row, and the second walks a seeded
// order through fulfilment.
test("customer places an order for a product through checkout", async ({
  page,
}) => {
  test.skip(
    process.env.MARKETPLACE_ENABLED !== "true",
    "Marketplace is hidden behind MARKETPLACE_ENABLED (default false) — see CLAUDE.md's MVP-scope section.",
  );

  const customer = await createUser({
    email: `buyer.${Date.now()}@e2e.test`,
    username: `buyer${Date.now()}`,
    firstName: "Buy",
    lastName: "Er",
  });
  const product = await db.product.findFirstOrThrow({
    where: { name: "Fixture Mirrorless Camera" },
  });

  await login(page, customer.email, TEST_PASSWORD);
  await page.goto(`/shop/${product.id}`);
  await page.getByRole("button", { name: "Buy now" }).click();

  await expect(page).toHaveURL(/\/cart/, { timeout: 10_000 });
  await page.getByRole("button", { name: "Checkout" }).click();

  await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 });
  await page.getByRole("radio", { name: "Pick up at shop" }).check();
  await page
    .getByRole("checkbox", { name: "I agree to the terms of sale/rental" })
    .check();
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/dashboard\/orders/, { timeout: 15_000 });
  const order = await db.order.findFirstOrThrow({
    where: { customerId: customer.id },
    include: { items: true },
  });
  expect(order.status).toBe("PENDING");
  expect(order.deliveryMethod).toBe("PICKUP");
  expect(order.items.map((item) => item.productId)).toContain(product.id);
});

test("shop fulfills a seeded order through to delivered", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.MARKETPLACE_ENABLED !== "true",
    "Marketplace is hidden behind MARKETPLACE_ENABLED (default false) — see CLAUDE.md's MVP-scope section.",
  );

  const customer = await createUser({
    email: `orderowner.${Date.now()}@e2e.test`,
    username: `orderowner${Date.now()}`,
    firstName: "Order",
    lastName: "Owner",
  });
  const shop = await db.user.findUniqueOrThrow({
    where: { username: "fixtureshop" },
  });
  const product = await db.product.findFirstOrThrow({
    where: { name: "Fixture Mirrorless Camera" },
  });

  const order = await seedPendingOrder({
    customerId: customer.id,
    shopId: shop.id,
    productId: product.id,
    unitPrice: product.price!,
  });

  await login(page, "fixture-shop@e2e.test", TEST_PASSWORD);
  await page.goto(`/dashboard/orders/${order.id}`);

  // Scoped to the status badge throughout — the action buttons' own labels
  // ("Mark as shipped", "Mark as delivered") case-insensitively contain the
  // target words, so an unscoped getByText matches them immediately and
  // races ahead of the real update (same class of bug as booking-review.spec.ts).
  const statusBadge = page.locator('[data-slot="badge"]').first();

  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(statusBadge).toHaveText("Confirmed", { timeout: 10_000 });

  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await page.getByLabel("Carrier").fill("GHTK");
  await page.getByLabel("Tracking number").fill("E2E123456");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Mark as shipped" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
  await expect(statusBadge).toHaveText("Shipped", { timeout: 10_000 });

  await page.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(statusBadge).toHaveText("Delivered", { timeout: 10_000 });

  const finalOrder = await db.order.findUniqueOrThrow({
    where: { id: order.id },
  });
  expect(finalOrder.status).toBe("DELIVERED");
  expect(finalOrder.trackingCarrier).toBe("GHTK");
  expect(finalOrder.trackingNumber).toBe("E2E123456");

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await login(customerPage, customer.email, TEST_PASSWORD);
  await customerPage.goto(`/dashboard/orders/${order.id}`);
  await expect(customerPage.locator('[data-slot="badge"]').first()).toHaveText(
    "Delivered",
    {
      timeout: 10_000,
    },
  );
  await customerContext.close();
});
