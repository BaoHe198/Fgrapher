import path from "node:path";

import { expect, test } from "@playwright/test";

import { createEmailVerificationToken } from "../src/services/email-verification";
import { db, TEST_PASSWORD } from "./helpers/db";

// Register as provider -> role activates automatically -> create profile ->
// upload portfolio -> appear in search.
//
// Stripe is disabled (BILLING_ENABLED=false — see CLAUDE.md's MVP-scope
// section and src/services/subscription.ts's assignFreePlan): the register
// route grants every selected paid role a free plan immediately, and
// /onboarding/billing itself redirects straight past to /dashboard, so
// there's no Checkout handoff to drive or degraded-mode message to assert
// here anymore.
//
// One step still can't be driven for real without live credentials this
// environment doesn't have (Cloudinary is unconfigured — confirmed empty,
// see e2e/README.md): "Upload portfolio" mocks the two network calls that
// leave this app's code (the Cloudinary upload itself, and Cloudinary's
// response shape) while exercising every line of first-party code around
// it for real: the signature request, the XHR upload call, and the
// POST /api/portfolio that persists the result.
//
// A second gap, unrelated to third-party services: there is no UI path
// anywhere in the app that sets Profile.isPublished (grepped every read/
// write site — see e2e/README.md) — search silently excludes every
// profile a real user creates, forever, with no error or affordance to
// fix it. This test documents that by flipping it directly via Prisma
// rather than pretending a "publish" button exists.
test("provider registers, activates a role, builds a profile, and appears in search", async ({
  page,
}) => {
  const email = `provider.e2e.${Date.now()}@e2e.test`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Provider Persona");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  // dd/mm/yyyy — DateField (src/components/ui/date-field.tsx) replaced the
  // native <input type="date">, whose value was ISO. An ISO string here is
  // simply not a parseable date to it, so the form fails validation and
  // never submits.
  await page.getByLabel("Date of birth").fill("01/01/1995");
  await page.getByRole("button", { name: "Creative pro" }).click();
  // A radio, not a checkbox, since the MVP capped an account at one active
  // provider role (CLAUDE.md) — picking a role now replaces the previous
  // selection instead of adding to it.
  await page.getByRole("radio", { name: "Photographer" }).check();
  await page
    .getByRole("checkbox", {
      name: /Tôi đồng ý cho Fgrapher xử lý dữ liệu cá nhân/,
    })
    .check();
  await page.getByRole("button", { name: "Create account" }).click();

  // Registration doesn't sign anyone in any more — a credential signup is
  // created unverified and authorize() refuses it until the emailed link is
  // clicked (docs/ops/email-verification.md). Same approach as
  // auth-customer.spec.ts: mint a token through the real code path and hit
  // the real /verify-email endpoint rather than flipping the column.
  await expect(page.getByText("Check your inbox")).toBeVisible({
    timeout: 15_000,
  });

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const { rawToken } = await createEmailVerificationToken(user.id);
  await page.goto(`/verify-email?token=${rawToken}`);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  const userRole = await db.userRole.findUniqueOrThrow({
    where: { userId_role: { userId: user.id, role: "PHOTOGRAPHER" } },
  });
  expect(userRole.active).toBe(true); // assignFreePlan activates it at registration time

  // --- Profile ---
  await page.goto("/dashboard/settings/profile");
  // The editor is an accordion and only "Basic information" starts open —
  // everything this test touches lives in the collapsed "Role profile"
  // panel, so its fields are not just hidden, they are absent from the DOM.
  await page.getByRole("button", { name: "Role profile" }).click();
  await page.getByLabel("Display name").fill("Provider Persona Photography");
  // The Description field's <label> has no htmlFor (a real accessibility
  // bug, confirmed by reading profile-settings-form.tsx — worth fixing
  // separately), so getByLabel can't find it; fall back to DOM structure.
  await page
    .getByText("Description", { exact: true })
    .locator("xpath=../..")
    .locator("textarea")
    .fill("E2E test provider — portrait and event photography.");
  // onSave() sets the "Saved" text regardless of the PATCH response status
  // (confirmed by reading profile-settings-form.tsx — another real bug,
  // worth fixing separately) so it isn't a reliable signal that the write
  // actually landed; wait on the response itself instead.
  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/profiles/PHOTOGRAPHER") &&
        res.request().method() === "PATCH",
    ),
    page.getByRole("button", { name: "Save changes" }).click(),
  ]);

  const profile = await db.profile.findUniqueOrThrow({
    where: { userId_role: { userId: user.id, role: "PHOTOGRAPHER" } },
  });
  expect(profile.isPublished).toBe(false); // no UI sets this true — see comment above

  // --- Portfolio upload (Cloudinary mocked, everything else real) ---
  await page.route("**/api/upload/signature", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          timestamp: 1,
          signature: "fake",
          apiKey: "fake",
          cloudName: "fake",
          folder: "fake",
        },
        error: null,
        message: null,
      }),
    });
  });
  await page.route("https://api.cloudinary.com/**/upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        secure_url: "https://example.com/fake-e2e-upload.jpg",
        public_id: "fake-e2e-upload",
        resource_type: "image",
        width: 800,
        height: 600,
      }),
    });
  });

  await page.goto("/dashboard/portfolio");
  await page.getByRole("button", { name: "Upload" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, "fixtures", "test-image.jpg"));
  await page.getByRole("button", { name: /^Upload \d+$/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });

  const media = await db.profileMedia.findMany({
    where: { profileId: profile.id },
  });
  expect(media).toHaveLength(1);
  expect(media[0].url).toBe("https://example.com/fake-e2e-upload.jpg");

  // --- Publish + appear in search (bridging the gap documented above) ---
  await db.profile.update({
    where: { id: profile.id },
    data: { isPublished: true },
  });

  await page.goto("/browse");
  await expect(
    page.getByText("Provider Persona Photography").first(),
  ).toBeVisible();
});
