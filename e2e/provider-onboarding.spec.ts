import path from "node:path";

import { expect, test } from "@playwright/test";

import { createEmailVerificationToken } from "../src/services/email-verification";
import { login } from "./helpers/auth";
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
// One step still can't be completed without live credentials: after the
// browser uploads to Cloudinary, POST /api/portfolio verifies the asset with
// Cloudinary's Admin API before persisting it. Playwright can mock the browser
// upload, but not that server-to-server verification. The spec therefore
// proves the UI fails safely, then seeds one approved asset to continue the
// profile-discovery half of this end-to-end journey.
//
// Publishing is automatic once identity verification, approved media,
// category and location gates all pass. Those gates have focused specs; this
// journey seeds the external/admin outcomes after exercising the provider UI.
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

  await login(page, email, TEST_PASSWORD);

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
  await page.getByRole("button", { name: "Portrait", exact: true }).click();

  const province = await db.province.findFirstOrThrow({
    include: { wards: { take: 1, orderBy: { code: "asc" } } },
    orderBy: { code: "asc" },
  });
  const ward = province.wards[0];
  expect(ward).toBeTruthy();
  // Select by stable visible names rather than generated CUIDs. A database
  // reset regenerates IDs, while the nationwide reference names stay fixed.
  await page.getByLabel("Main province").selectOption({ label: province.name });
  await expect(page.getByLabel("Ward")).toBeEnabled();
  await page.getByLabel("Ward").selectOption({ label: ward.name });
  await page.getByLabel("Detailed address").fill("12 Nguyen Hue");
  // onSave() sets the "Saved" text regardless of the PATCH response status
  // (confirmed by reading profile-settings-form.tsx — another real bug,
  // worth fixing separately) so it isn't a reliable signal that the write
  // actually landed; wait on the response itself instead.
  const [profileResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/profiles/PHOTOGRAPHER") &&
        res.request().method() === "PATCH",
    ),
    page.getByRole("button", { name: "Save changes" }).click(),
  ]);
  expect(profileResponse.ok(), await profileResponse.text()).toBe(true);

  const profile = await db.profile.findUniqueOrThrow({
    where: { userId_role: { userId: user.id, role: "PHOTOGRAPHER" } },
  });
  expect(profile.isPublished).toBe(false); // KYC and approved media are still missing.

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
          folder: `fgrapher/portfolio/${user.id}`,
          transformation: "fl_strip_profile",
          allowedFormats: "jpg,jpeg,png,webp,gif,mp4,mov,webm",
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
        public_id: `fgrapher/portfolio/${user.id}/fake-e2e-upload`,
        resource_type: "image",
        width: 800,
        height: 600,
      }),
    });
  });

  await page.goto("/dashboard/portfolio");
  await page.getByRole("button", { name: "Upload photos" }).first().click();
  const uploadDialog = page.getByRole("dialog", { name: "Upload media" });
  await uploadDialog.getByLabel("Album").selectOption({
    label: "+ Create new album",
  });
  await uploadDialog.getByLabel("Album title").fill("Portrait work");
  await uploadDialog.getByLabel("Category").selectOption({
    label: "Portrait",
  });
  await uploadDialog.getByRole("button", { name: "Create album" }).click();
  await uploadDialog
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, "fixtures", "test-image.jpg"));
  await uploadDialog
    .getByRole("checkbox", { name: /I confirm I have the rights/ })
    .check();
  await uploadDialog.getByRole("button", { name: /^Upload \d+$/ }).click();
  await expect(uploadDialog.getByText("Upload failed")).toBeVisible({
    timeout: 15_000,
  });
  await uploadDialog.getByRole("button", { name: "Close" }).click();

  const album = await db.album.findFirstOrThrow({
    where: { profileId: profile.id, title: "Portrait work" },
  });
  const media = await db.profileMedia.create({
    data: {
      profileId: profile.id,
      albumId: album.id,
      url: "https://example.com/fake-e2e-upload.jpg",
      publicId: `fgrapher/portfolio/${user.id}/fake-e2e-upload`,
      type: "IMAGE",
      moderationStatus: "APPROVED",
      rightsConfirmedAt: new Date(),
    },
  });
  expect(media.url).toBe("https://example.com/fake-e2e-upload.jpg");

  // --- Apply the verified/approved outcomes, then appear in search ---
  await db.profile.update({
    where: { id: profile.id },
    data: { isPublished: true },
  });

  // The final publish above is an intentional test-only DB shortcut, so it
  // cannot call Next's request-scoped revalidateTag hook. Search by the new
  // profile's unique name to use a fresh cache key while still exercising
  // the real public search path.
  await page.goto("/browse?q=Provider%20Persona%20Photography");
  await expect(
    page.getByText("Provider Persona Photography").first(),
  ).toBeVisible();
});
