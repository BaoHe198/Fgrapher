import path from "node:path";

import { expect, test } from "@playwright/test";

import { createEmailVerificationToken } from "../src/services/email-verification";
import { login } from "./helpers/auth";
import { db, TEST_PASSWORD } from "./helpers/db";

// Register as provider -> verify email -> role active on a free plan ->
// build a profile -> try a portfolio upload -> profile goes live on its own
// -> appear in search.
//
// Stripe is disabled (BILLING_ENABLED=false — see CLAUDE.md's MVP-scope
// section): registration grants the selected paid role a free plan at once
// (FREE_ROLE_GRANT_ENABLED), so there is no checkout step to drive.
//
// Two outcomes come from outside the provider's own UI and are written
// directly, each standing in for one real event:
//
// 1. The portfolio upload. After the browser uploads to Cloudinary,
//    POST /api/portfolio re-checks the asset with Cloudinary's Admin API
//    (verifyPortfolioUpload) and refuses it when Cloudinary isn't
//    configured. Playwright can mock the browser half but not that
//    server-to-server check, so the spec asserts the upload fails closed —
//    no row written — and then seeds one approved photo as moderation
//    would leave it.
// 2. Identity verification. An admin approves it at /admin/verifications;
//    that flow has its own spec, so the role is marked VERIFIED here.
//
// Publishing itself is NOT written directly. There is no publish button:
// a profile goes live on its own once identity, plan, an approved photo, a
// category and a location are all in place (tryAutoPublish). Saving the
// profile again runs that real gate, so a regression in any of the checks
// fails this spec instead of being papered over.
test("provider registers, activates a role, builds a profile, and appears in search", async ({
  page,
}) => {
  const email = `provider.e2e.${Date.now()}@e2e.test`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Provider Persona");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  // dd/mm/yyyy — DateField (src/components/ui/date-field.tsx) does not
  // accept the ISO value a native date input would take.
  await page.getByLabel("Date of birth").fill("01/01/1995");
  await page.getByRole("button", { name: "Creative pro" }).click();
  // A radio, not a checkbox: an account holds one provider role at a time.
  await page.getByRole("radio", { name: "Photographer" }).check();
  await page
    .getByRole("checkbox", {
      name: /Tôi đồng ý cho Fgrapher xử lý dữ liệu cá nhân/,
    })
    .check();
  await page.getByRole("button", { name: "Create account" }).click();

  // A credential signup can't sign in until its emailed link is clicked
  // (docs/ops/email-verification.md). Mint the token through the real code
  // path and open the real /verify-email page rather than flip the column.
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
    include: { subscription: true },
  });
  expect(userRole.active).toBe(true);
  expect(userRole.subscription?.status).toBe("ACTIVE");
  expect(userRole.verificationStatus).not.toBe("VERIFIED");

  // --- Profile ---
  await page.goto("/dashboard/settings/profile");
  // Accordion: only "Basic information" starts open, and the collapsed
  // "Role profile" panel's fields are not in the DOM until it opens.
  await page.getByRole("button", { name: "Role profile" }).click();
  await page.getByLabel("Display name").fill("Provider Persona Photography");
  await page
    .getByText("Description", { exact: true })
    .locator("xpath=../..")
    .locator("textarea")
    .fill("E2E test provider — portrait and event photography.");
  // At least one category is required before a profile can go public.
  await page.getByRole("button", { name: "Portrait", exact: true }).click();

  // Pick the location by its reference names, which survive a database
  // reset; the generated ids do not.
  const province = await db.province.findFirstOrThrow({
    include: { wards: { take: 1, orderBy: { code: "asc" } } },
    orderBy: { code: "asc" },
  });
  const ward = province.wards[0];
  expect(ward).toBeTruthy();
  await page.getByLabel("Main province").selectOption({ label: province.name });
  // The open "Basic information" panel has its own Ward field; the role
  // profile's comes after it.
  const wardSelect = page.getByLabel("Ward", { exact: true }).last();
  await expect(wardSelect.locator("option")).not.toHaveCount(1);
  await wardSelect.selectOption({ label: ward.name });
  await page.getByLabel("Detailed address").fill("12 Lê Lợi");

  const saveProfile = async () => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/profiles/PHOTOGRAPHER") &&
          res.request().method() === "PATCH",
      ),
      page.getByRole("button", { name: "Save changes" }).click(),
    ]);
    expect(response.ok(), await response.text()).toBe(true);
  };
  await saveProfile();

  const profile = await db.profile.findUniqueOrThrow({
    where: { userId_role: { userId: user.id, role: "PHOTOGRAPHER" } },
  });
  expect(profile.categories).toContain("PORTRAIT");
  expect(profile.provinceId).toBe(province.id);
  expect(profile.wardId).toBe(ward.id);
  // Identity and an approved photo are still missing.
  expect(profile.isPublished).toBe(false);

  // --- Portfolio upload: browser half mocked, server check fails closed ---
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
  await page.getByRole("button", { name: "Upload" }).click();
  // With no album yet, the dialog opens straight on the create-album form.
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Album title").fill("Wedding highlights");
  await dialog.getByLabel("Category").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Create album" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, "fixtures", "test-image.jpg"));
  // Rights / consent confirmation is required before any upload.
  await dialog
    .getByRole("checkbox", { name: /I confirm I have the rights/ })
    .check();

  const [portfolioResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/portfolio") &&
        res.request().method() === "POST",
    ),
    dialog.getByRole("button", { name: /^Upload \d+$/ }).click(),
  ]);
  expect(portfolioResponse.ok()).toBe(false);
  await expect(dialog.getByText("Upload failed")).toBeVisible();
  expect(
    await db.profileMedia.count({ where: { profileId: profile.id } }),
  ).toBe(0);

  // --- The two outside outcomes (see the header comment) ---
  const album = await db.album.findFirstOrThrow({
    where: { profileId: profile.id, title: "Wedding highlights" },
  });
  await db.profileMedia.create({
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
  await db.userRole.update({
    where: { id: userRole.id },
    data: { verificationStatus: "VERIFIED" },
  });

  // --- Goes live on its own: saving re-runs the real publish gate ---
  await page.goto("/dashboard/settings/profile");
  await page.getByRole("button", { name: "Role profile" }).click();
  await expect(page.getByLabel("Display name")).toHaveValue(
    "Provider Persona Photography",
  );
  await saveProfile();

  await expect
    .poll(
      async () =>
        (await db.profile.findUniqueOrThrow({ where: { id: profile.id } }))
          .isPublished,
    )
    .toBe(true);

  // Searched by name, as a customer would: in a full run other specs add
  // enough providers that a brand-new one with no reviews isn't on the
  // first page of the unfiltered list.
  await page.goto(`/browse?q=${encodeURIComponent("Provider Persona")}`);
  await expect(
    page.getByText("Provider Persona Photography").first(),
  ).toBeVisible();
});
