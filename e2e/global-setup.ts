import { execSync } from "node:child_process";

import {
  activatePaidRole,
  createProduct,
  createPublishedProfile,
  createUser,
  disconnect,
  seedWeekdayAvailability,
} from "./helpers/db";

// Runs once before the whole suite. Resets the test database to a known,
// empty-except-fixtures state on every run — safe because this only ever
// targets DATABASE_URL from .env.test (a disposable Postgres instance, see
// e2e/README.md), never dev or prod. Idempotent by design so repeated local
// runs against a persistent local Postgres behave the same as a fresh
// container in CI.
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Run tests via `pnpm test:e2e`, which loads e2e/.env.test " +
        "(copy e2e/.env.test.example first) — see e2e/README.md.",
    );
  }

  execSync("npx prisma migrate reset --force --skip-seed", {
    stdio: "inherit",
    env: process.env,
  });

  // One published, bookable provider fixture reused across booking/
  // messaging/marketplace-style tests as "the counterparty" — individual
  // test files create whichever customer/provider they're specifically
  // exercising themselves.
  const provider = await createUser({
    email: "fixture-provider@e2e.test",
    username: "fixtureprovider",
    firstName: "Fixture",
    lastName: "Provider",
    roles: ["PHOTOGRAPHER"],
    location: "Đà Nẵng",
  });
  await activatePaidRole(provider.id, "PHOTOGRAPHER");
  await seedWeekdayAvailability(provider.id);
  await createPublishedProfile({
    userId: provider.id,
    role: "PHOTOGRAPHER",
    displayName: "Fixture Provider Photography",
    description: "Seeded E2E fixture — wedding and portrait photography.",
    priceMin: 1_000_000,
    priceMax: 8_000_000,
    services: [
      { name: "Portrait Session", description: "90 min portrait shoot", duration: 90, price: 1_500_000 },
    ],
  });

  // Fixture shop + product for marketplace tests, same "shared
  // counterparty" reasoning as the provider fixture above.
  const shop = await createUser({
    email: "fixture-shop@e2e.test",
    username: "fixtureshop",
    firstName: "Fixture",
    lastName: "Shop",
    roles: ["CAMERA_SHOP"],
    location: "Hà Nội",
  });
  await activatePaidRole(shop.id, "CAMERA_SHOP");
  await createPublishedProfile({
    userId: shop.id,
    role: "CAMERA_SHOP",
    displayName: "Fixture Camera Shop",
    description: "Seeded E2E fixture shop.",
  });
  await createProduct({ userId: shop.id, name: "Fixture Mirrorless Camera", price: 25_000_000 });

  await disconnect();
}
