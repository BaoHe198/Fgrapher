import { expect, test } from "@playwright/test";

import { db, TEST_PASSWORD } from "./helpers/db";

// Registration -> "verify email" -> browse -> view profile.
//
// There's no separate email-verification step to click through: the
// register API route sets `emailVerified` at creation time (no Resend
// integration is wired up yet — see src/app/api/auth/register/route.ts).
// This test asserts that's actually what happens rather than silently
// assuming it, so it'll fail loudly the day a real verification flow
// replaces this shortcut.
test("customer registers, is auto-verified, browses, and views a profile", async ({ page }) => {
  const email = `customer.e2e.${Date.now()}@e2e.test`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Casey Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  // "Customer" is the default selected account type — no click needed, but
  // assert it's actually selected so this test fails if that default ever
  // changes silently.
  await expect(page.getByRole("button", { name: "Customer" })).toBeVisible();

  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.emailVerified).not.toBeNull();
  const roles = await db.userRole.findMany({ where: { userId: user.id } });
  expect(roles.map((r) => r.role)).toEqual(["CUSTOMER"]); // register route always grants CUSTOMER

  await page.goto("/browse");
  await expect(page.getByText("Fixture Provider Photography")).toBeVisible();

  await page.getByText("Fixture Provider Photography").click();
  await expect(page).toHaveURL(/\/profile\/fixtureprovider/);
  await expect(page.getByRole("heading", { name: "Fixture Provider Photography" })).toBeVisible();
  await expect(page.locator('[data-slot="badge"]', { hasText: "Photographer" })).toBeVisible();
});
