import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import {
  activatePaidRole,
  createPublishedProfile,
  createUser,
  db,
  TEST_PASSWORD,
} from "./helpers/db";

// Prompt G3 (docs/guides/fgrapher-prompt-dot-2.md), VIỆC 4 + VIỆC 3's photo
// limit note — the two things the prompt explicitly asked for a test on
// beyond the migration itself ("album rỗng không hiện công khai" and "giới
// hạn số ảnh theo gói vẫn đúng khi tính trên nhiều album"). Migration
// data-safety already has its own check: scripts/verify-album-migration.ts.

async function seedMedia(
  profileId: string,
  opts: {
    albumId?: string;
    moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  },
) {
  return db.profileMedia.create({
    data: {
      profileId,
      albumId: opts.albumId,
      url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      type: "IMAGE",
      moderationStatus: opts.moderationStatus ?? "APPROVED",
    },
  });
}

test("an album with no approved photos is hidden from the public profile, one with approved photos is shown", async ({
  page,
}) => {
  const timestamp = Date.now();
  const provider = await createUser({
    email: `albumpub.${timestamp}@e2e.test`,
    username: `albumpub${timestamp}`,
    firstName: "Album",
    lastName: "Provider",
    roles: ["PHOTOGRAPHER"],
  });
  const profile = await createPublishedProfile({
    userId: provider.id,
    role: "PHOTOGRAPHER",
    displayName: "Album Visibility Fixture",
  });
  await db.profile.update({
    where: { id: profile.id },
    data: { categories: ["WEDDING"] },
  });

  const emptyAlbum = await db.album.create({
    data: {
      profileId: profile.id,
      title: "Album rỗng",
      category: "WEDDING",
      sortOrder: 0,
    },
  });
  // Has a photo, but it's still PENDING — should count as "no approved
  // photos" too, not just literally zero ProfileMedia rows.
  await seedMedia(profile.id, {
    albumId: emptyAlbum.id,
    moderationStatus: "PENDING",
  });

  const visibleAlbum = await db.album.create({
    data: {
      profileId: profile.id,
      title: "Album có ảnh",
      category: "WEDDING",
      sortOrder: 1,
    },
  });
  await seedMedia(profile.id, {
    albumId: visibleAlbum.id,
    moderationStatus: "APPROVED",
  });

  await page.goto(`/profile/${provider.username}`);

  await expect(page.getByText("Album có ảnh")).toBeVisible();
  await expect(page.getByText("Album rỗng")).not.toBeVisible();
});

test("the portfolio photo limit is enforced across ALL of a profile's albums combined, not per album", async ({
  page,
}) => {
  const timestamp = Date.now();
  const provider = await createUser({
    email: `albumlimit.${timestamp}@e2e.test`,
    username: `albumlimit${timestamp}`,
    firstName: "Limit",
    lastName: "Provider",
    roles: ["PHOTOGRAPHER"],
  });
  await activatePaidRole(provider.id, "PHOTOGRAPHER");
  const profile = await createPublishedProfile({
    userId: provider.id,
    role: "PHOTOGRAPHER",
    displayName: "Album Limit Fixture",
  });

  const albumA = await db.album.create({
    data: {
      profileId: profile.id,
      title: "Album A",
      category: "WEDDING",
      sortOrder: 0,
    },
  });
  const albumB = await db.album.create({
    data: {
      profileId: profile.id,
      title: "Album B",
      category: "PORTRAIT",
      sortOrder: 1,
    },
  });

  // PHOTOGRAPHER's plan caps at 30 (DEFAULT_MAX_PORTFOLIO_IMAGES) — seed
  // exactly that many, split across two different albums, so the count is
  // already at the ceiling before the next upload attempt.
  const PORTFOLIO_LIMIT = 30;
  const half = PORTFOLIO_LIMIT / 2;
  for (let i = 0; i < half; i++) {
    await seedMedia(profile.id, { albumId: albumA.id });
  }
  for (let i = 0; i < PORTFOLIO_LIMIT - half; i++) {
    await seedMedia(profile.id, { albumId: albumB.id });
  }

  await login(page, provider.email, TEST_PASSWORD);

  const response = await page.request.post("/api/portfolio", {
    data: {
      profileId: profile.id,
      albumId: albumA.id,
      url: "https://res.cloudinary.com/demo/image/upload/one_more.jpg",
      publicId: "one_more",
      type: "IMAGE",
      rightsConfirmed: true,
    },
  });

  expect(response.ok()).toBe(false);
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.error).toBe("limit_reached");

  const total = await db.profileMedia.count({
    where: { profileId: profile.id },
  });
  expect(total).toBe(PORTFOLIO_LIMIT);
});
