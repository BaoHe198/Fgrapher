import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import {
  createUser,
  createPublishedProfile,
  db,
  TEST_PASSWORD,
} from "./helpers/db";

// Prompt F1 (docs/guides/fgrapher-prompt-sua-loi-mvp_1.md) — the admin
// unlock: a non-admin must never see /admin/* content, and the media
// moderation queue must actually flip ProfileMedia.moderationStatus, log
// an AuditLog row, and the result must be what gates public visibility on
// /profile/[username] (getPublicProfileUser only ever includes
// moderationStatus: "APPROVED" media).

async function seedPendingMedia(profileId: string) {
  return db.profileMedia.create({
    data: {
      profileId,
      url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      type: "IMAGE",
      moderationStatus: "PENDING",
    },
  });
}

test("non-admin visiting /admin/* gets a 404, not a redirect leaking its existence", async ({
  page,
}) => {
  const user = await createUser({
    email: `nonadmin.${Date.now()}@e2e.test`,
    username: `nonadmin${Date.now()}`,
    firstName: "Not",
    lastName: "Admin",
    roles: ["CUSTOMER"],
  });

  await login(page, user.email, TEST_PASSWORD);

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);

  const moderationResponse = await page.goto("/admin/moderation");
  expect(moderationResponse?.status()).toBe(404);
});

test("admin approves a pending photo: status flips, AuditLog is written, photo goes public", async ({
  page,
}) => {
  const timestamp = Date.now();
  const admin = await createUser({
    email: `modadmin.${timestamp}@e2e.test`,
    username: `modadmin${timestamp}`,
    firstName: "Mod",
    lastName: "Admin",
    roles: ["ADMIN"],
  });
  const provider = await createUser({
    email: `modprovider.${timestamp}@e2e.test`,
    username: `modprovider${timestamp}`,
    firstName: "Provider",
    lastName: "Tester",
    roles: ["PHOTOGRAPHER"],
  });
  const profile = await createPublishedProfile({
    userId: provider.id,
    role: "PHOTOGRAPHER",
    displayName: "Moderation Fixture Photographer",
  });
  const media = await seedPendingMedia(profile.id);

  await login(page, admin.email, TEST_PASSWORD);

  const response = await page.request.patch("/api/admin/moderation", {
    data: { action: "approve", mediaIds: [media.id] },
  });
  expect(response.ok()).toBe(true);

  const updated = await db.profileMedia.findUniqueOrThrow({
    where: { id: media.id },
  });
  expect(updated.moderationStatus).toBe("APPROVED");
  expect(updated.moderatedBy).toBe(admin.id);

  const auditLog = await db.auditLog.findFirst({
    where: { targetType: "profile_media", targetId: media.id },
  });
  expect(auditLog?.action).toBe("MEDIA_APPROVED");

  // Now-APPROVED media must render on the public profile — this is the
  // whole point of the moderation gate (Profile.isPublished requires at
  // least one APPROVED ProfileMedia row, per services/public-profile.ts).
  await page.goto(`/profile/${provider.username}`);
  await expect(page.locator(`img[src="${media.url}"]`)).toBeVisible();
});

test("admin rejects a pending photo with a reason: status flips and AuditLog records it", async ({
  page,
}) => {
  const timestamp = Date.now();
  const admin = await createUser({
    email: `rejadmin.${timestamp}@e2e.test`,
    username: `rejadmin${timestamp}`,
    firstName: "Rej",
    lastName: "Admin",
    roles: ["ADMIN"],
  });
  const provider = await createUser({
    email: `rejprovider.${timestamp}@e2e.test`,
    username: `rejprovider${timestamp}`,
    firstName: "Provider",
    lastName: "Tester",
    roles: ["PHOTOGRAPHER"],
  });
  const profile = await createPublishedProfile({
    userId: provider.id,
    role: "PHOTOGRAPHER",
    displayName: "Rejection Fixture Photographer",
  });
  const media = await seedPendingMedia(profile.id);

  await login(page, admin.email, TEST_PASSWORD);

  const response = await page.request.patch("/api/admin/moderation", {
    data: {
      action: "reject",
      mediaIds: [media.id],
      reason: "Chất lượng quá thấp",
    },
  });
  expect(response.ok()).toBe(true);

  const updated = await db.profileMedia.findUniqueOrThrow({
    where: { id: media.id },
  });
  expect(updated.moderationStatus).toBe("REJECTED");
  expect(updated.moderationNote).toBe("Chất lượng quá thấp");

  const auditLog = await db.auditLog.findFirst({
    where: { targetType: "profile_media", targetId: media.id },
  });
  expect(auditLog?.action).toBe("MEDIA_REJECTED");
  expect((auditLog?.metadata as { reason?: string } | null)?.reason).toBe(
    "Chất lượng quá thấp",
  );
});
