import fs from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { createUser, db, TEST_PASSWORD } from "./helpers/db";

// Prompt B2 (docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md) — the
// personal-data compliance layer: consent tracking at registration, and
// the /dashboard/settings/data page for reviewing/exporting/deleting.
test("registration records exactly 3 ConsentRecord rows, one per purpose", async ({
  page,
}) => {
  const email = `consent.e2e.${Date.now()}@e2e.test`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Consent Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  // Only the mandatory SERVICE checkbox is checked — MARKETING and
  // ANALYTICS are deliberately left unticked to prove neither blocks
  // registration (registerSchema only refines on consentService).
  await page
    .getByRole("checkbox", {
      name: /Tôi đồng ý cho Fgrapher xử lý dữ liệu cá nhân/,
    })
    .check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const records = await db.consentRecord.findMany({
    where: { userId: user.id },
  });
  expect(records).toHaveLength(3);
  expect(records.find((r) => r.purpose === "SERVICE")?.granted).toBe(true);
  expect(records.find((r) => r.purpose === "MARKETING")?.granted).toBe(false);
  expect(records.find((r) => r.purpose === "ANALYTICS")?.granted).toBe(false);
});

test("data & privacy settings: toggle consent, export data, request deletion", async ({
  page,
}) => {
  const user = await createUser({
    email: `privacy.e2e.${Date.now()}@e2e.test`,
    username: `privacye2e${Date.now()}`,
    firstName: "Privacy",
    lastName: "Tester",
  });

  await login(page, user.email, TEST_PASSWORD);
  await page.goto("/dashboard/settings/data");

  // Toggling MARKETING on writes a new granted=true ConsentRecord row —
  // recordConsent always inserts, never updates in place (see
  // services/compliance.ts), so this reads back the latest row.
  await page.getByRole("switch", { name: "Thông tin khuyến mại" }).click();
  await expect(page.getByText("Đã cập nhật lựa chọn")).toBeVisible({
    timeout: 10_000,
  });
  await expect
    .poll(async () => {
      const latest = await db.consentRecord.findFirst({
        where: { userId: user.id, purpose: "MARKETING" },
        orderBy: { createdAt: "desc" },
      });
      return latest?.granted;
    })
    .toBe(true);

  // "Tải về dữ liệu của tôi" downloads a complete JSON export.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Tải về dữ liệu của tôi" }).click(),
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const exported = JSON.parse(
    await fs.readFile(downloadPath as string, "utf-8"),
  );
  expect(exported.user.email).toBe(user.email);
  expect(Array.isArray(exported.consentHistory)).toBe(true);
  expect(exported.consentHistory.length).toBeGreaterThan(0);

  // Deletion only ever queues a DataRequest — it must not touch the User
  // row itself (that only happens once staff runs processDeletion).
  await page.getByRole("button", { name: "Yêu cầu xóa tài khoản" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Xác nhận gửi yêu cầu" }).click();
  await expect(page.getByText("đang chờ xử lý")).toBeVisible({
    timeout: 10_000,
  });

  const deletionRequest = await db.dataRequest.findFirstOrThrow({
    where: { userId: user.id, type: "DELETION" },
  });
  expect(deletionRequest.status).toBe("PENDING");

  const stillExists = await db.user.findUnique({ where: { id: user.id } });
  expect(stillExists).not.toBeNull();
});

// "Tắt MARKETING thì không nhận email marketing" (the guide's third
// scenario) isn't observable end-to-end yet: no NotificationType in
// prisma/schema.prisma is classified as marketing, so no code path in the
// app actually sends a marketing email today — see the
// MARKETING_PREFERENCE_KEYS comment in src/services/notification.ts. The
// gate itself (sendMarketingEmail in src/lib/email.ts, wired through
// notify()) is in place for whenever a promotional NotificationType is
// added; there's just no send call site yet to drive through the UI.
