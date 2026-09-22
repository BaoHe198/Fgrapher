import { expect, test } from "@playwright/test";

import { issuePasswordResetToken } from "../src/services/password-reset";
import {
  createUser,
  getLatestVerificationToken,
  TEST_PASSWORD,
} from "./helpers/db";

// Full password-reset cycle. Resend isn't configured in this environment
// (sendEmail no-ops silently — see src/lib/email.ts). The reset token is
// written to the database regardless, but only as a hash, so it can't be
// read back out — see e2e/README.md.
test("user resets their password end to end", async ({ page }) => {
  const email = `reset.${Date.now()}@e2e.test`;
  const user = await createUser({
    email,
    username: `reset${Date.now()}`,
    firstName: "Reset",
    lastName: "Case",
  });

  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/check your inbox/i)).toBeVisible({
    timeout: 10_000,
  });

  // The form issued a token, stored hashed.
  const record = await getLatestVerificationToken(email);
  expect(record).not.toBeNull();
  expect(record!.token).toMatch(/^sha256:[0-9a-f]{64}$/);

  // Mint a known token through the same issuance the form used (replacing
  // that one), then click the link it would have emailed.
  const { rawToken } = await issuePasswordResetToken({
    userId: user.id,
    email,
  });
  const newPassword = "NewPass123!";
  await page.goto(`/reset-password?token=${rawToken}`);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  // The "Password updated" success toast persists across the redirect and
  // is (surprisingly) also matched by getByLabel("Password") — its
  // accessible name overlaps the real field's. Scope to the form.
  const loginForm = page.locator("form");

  // Old password no longer works.
  await loginForm
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(email);
  await loginForm.getByLabel("Password").fill(TEST_PASSWORD);
  await loginForm.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible({
    timeout: 10_000,
  });

  // New password does. The failed attempt above redirected to
  // /login?error=... (a full page load), clearing the email field, so it
  // needs refilling too.
  await loginForm
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(email);
  await loginForm.getByLabel("Password").fill(newPassword);
  await loginForm.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});
