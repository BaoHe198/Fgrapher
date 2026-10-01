import { expect, test } from "@playwright/test";

import { createProduct, createUser, db, TEST_PASSWORD } from "./helpers/db";
import { login } from "./helpers/auth";

// "Báo cho tôi khi có hàng" (wave 2 Chợ F): a customer asks on an
// out-of-stock listing, the shop restocks it, and the customer gets one
// in-app notice that opens the listing.
test("customer asks to hear about an out-of-stock product and is told when it is restocked", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.MARKETPLACE_ENABLED !== "true",
    "Marketplace is hidden behind MARKETPLACE_ENABLED.",
  );

  const stamp = Date.now();
  const shop = await db.user.findUniqueOrThrow({
    where: { username: "fixtureshop" },
  });
  const product = await createProduct({
    userId: shop.id,
    name: `Sold-out Lens ${stamp}`,
    price: 9_000_000,
    stock: 0,
  });
  const customer = await createUser({
    email: `waiter.${stamp}@e2e.test`,
    username: `waiter${stamp}`,
    firstName: "Wait",
    lastName: "Er",
  });

  await login(page, customer.email, TEST_PASSWORD);
  await page.goto(`/shop/${product.id}`);
  await page.getByRole("button", { name: "Tell me when it's back" }).click();
  await expect(
    page.getByRole("button", { name: "We'll tell you · Stop following" }),
  ).toBeVisible();
  const alert = await db.stockAlert.findUniqueOrThrow({
    where: { userId_productId: { userId: customer.id, productId: product.id } },
  });
  expect(alert.notifiedAt).toBeNull();

  // The shop puts stock back through its own edit endpoint.
  const shopContext = await browser.newContext();
  const shopPage = await shopContext.newPage();
  await login(shopPage, "fixture-shop@e2e.test", TEST_PASSWORD);
  const res = await shopPage.request.patch(`/api/products/${product.id}`, {
    data: {
      name: product.name,
      description: "E2E fixture product.",
      category: "Camera body",
      type: "SALE",
      price: 9_000_000,
      condition: "AVERAGE",
      stock: 3,
      isActive: true,
      images: [],
    },
  });
  expect(res.status()).toBe(200);
  await shopContext.close();

  await expect
    .poll(async () =>
      db.notification.count({
        where: { userId: customer.id, type: "PRODUCT_BACK_IN_STOCK" },
      }),
    )
    .toBe(1);
  const answered = await db.stockAlert.findUniqueOrThrow({
    where: { id: alert.id },
  });
  expect(answered.notifiedAt).not.toBeNull();
  const restocked = await db.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  expect(restocked.condition).toBe("AVERAGE");
});
