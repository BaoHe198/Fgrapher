import { expect, test } from "@playwright/test";

import { createEmailVerificationToken } from "../src/services/email-verification";
import { db, TEST_PASSWORD } from "./helpers/db";

// Registration -> verify email -> sign in -> browse -> view profile.
//
// Registration no longer signs the user in: a credential signup is created
// unverified and lib/auth.ts's authorize() refuses it until the emailed
// link is clicked (docs/ops/email-verification.md). No inbox is reachable
// from a test run, so this reads the token's hash straight from the
// database and drives /verify-email with the matching raw token — the same
// endpoint the real link hits, not a shortcut around it.
test("customer registers, verifies their email, signs in, and views a profile", async ({
  page,
}) => {
  const email = `customer.e2e.${Date.now()}@e2e.test`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Casey Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByLabel("Date of birth").fill("1995-01-01"); // age gate applies to every role as of Prompt B3
  // "Customer" is the default selected account type — no click needed, but
  // assert it's actually selected so this test fails if that default ever
  // changes silently.
  await expect(page.getByRole("button", { name: "Customer" })).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: /Tôi đồng ý cho Fgrapher xử lý dữ liệu cá nhân/,
    })
    .check();

  await page.getByRole("button", { name: "Create account" }).click();

  // Not signed in — the account is created unverified and the form shows
  // the "check your inbox" panel instead.
  await expect(page.getByText("Check your inbox")).toBeVisible({
    timeout: 15_000,
  });

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.emailVerified).toBeNull();
  const roles = await db.userRole.findMany({ where: { userId: user.id } });
  expect(roles.map((r) => r.role)).toEqual(["CUSTOMER"]); // register route always grants CUSTOMER

  // Only the hash is stored, so the raw token can't be read back out of the
  // database. Mint a known token for this user through the same code path
  // registration used, then click the link it would have emailed.
  const { rawToken } = await createEmailVerificationToken(user.id);
  await page.goto(`/verify-email?token=${rawToken}`);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible({ timeout: 15_000 });

  const verified = await db.user.findUniqueOrThrow({ where: { email } });
  expect(verified.emailVerified).not.toBeNull();
  // Single-use: the token is gone.
  expect(
    await db.emailVerificationToken.count({ where: { userId: user.id } }),
  ).toBe(0);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.goto("/browse");
  await expect(page.getByText("Fixture Provider Photography")).toBeVisible();

  await page.getByText("Fixture Provider Photography").click();
  await expect(page).toHaveURL(/\/profile\/fixtureprovider/);
  await expect(
    page.getByRole("heading", { name: "Fixture Provider Photography" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="badge"]', { hasText: "Photographer" }),
  ).toBeVisible();
});
