import { expect, test } from "@playwright/test";

import { createUser, getLatestVerificationToken, TEST_PASSWORD } from "./helpers/db";

// Full password-reset cycle. Resend isn't configured in this environment
// (sendEmail no-ops silently — see src/lib/email.ts), but the reset token
// is written to the database regardless of whether the email actually
// sends, so this reads it directly from VerificationToken instead of an
// inbox — see e2e/README.md.
test("user resets their password end to end", async ({ page }) => {
  const email = `reset.${Date.now()}@e2e.test`;
  await createUser({
    email,
    username: `reset${Date.now()}`,
    firstName: "Reset",
    lastName: "Case",
  });

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 10_000 });

  const record = await getLatestVerificationToken(email);
  expect(record).not.toBeNull();

  const newPassword = "NewPass123!";
  await page.goto(`/reset-password?token=${record!.token}`);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  // The "Password updated" success toast persists across the redirect and
  // is (surprisingly) also matched by getByLabel("Password") — its
  // accessible name overlaps the real field's. Scope to the form.
  const loginForm = page.locator("form");

  // Old password no longer works.
  await loginForm.getByLabel("Email").fill(email);
  await loginForm.getByLabel("Password").fill(TEST_PASSWORD);
  await loginForm.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 10_000 });

  // New password does. The failed attempt above redirected to
  // /login?error=... (a full page load), clearing the email field, so it
  // needs refilling too.
  await loginForm.getByLabel("Email").fill(email);
  await loginForm.getByLabel("Password").fill(newPassword);
  await loginForm.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});
