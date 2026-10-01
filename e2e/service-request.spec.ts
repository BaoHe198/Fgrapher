import { expect, test } from "@playwright/test";

import {
  activatePaidRole,
  createPublishedProfile,
  createUser,
  db,
  seedWeekdayAvailability,
  TEST_PASSWORD,
} from "./helpers/db";
import { login } from "./helpers/auth";

// A weekday comfortably past every notice window, as yyyy-mm-dd and as the
// dd/mm/yyyy the date field reads.
function futureWeekday(daysAhead: number) {
  const date = new Date(Date.now() + daysAhead * 86_400_000);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const iso = date.toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-");
  return { iso, typed: `${d}/${m}/${y}` };
}

test("customer posts a request question by question, compares two proposals and picks one", async ({
  page,
}) => {
  const stamp = Date.now();
  const province = await db.province.findFirstOrThrow({
    orderBy: { name: "asc" },
  });
  const customer = await createUser({
    email: `requester.${stamp}@e2e.test`,
    username: `requester${stamp}`,
    firstName: "Request",
    lastName: "Er",
  });

  // The test environment requires a verified phone to post (anti-fake
  // request rule); the SMS step has its own coverage.
  await db.user.update({
    where: { id: customer.id },
    data: {
      phone: `09${String(stamp).slice(-8)}`,
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
    },
  });

  // --- Compose: six questions, keyboard shortcuts and Enter ---------------
  await login(page, customer.email, TEST_PASSWORD);
  await page.goto("/requests/new");
  await expect(
    page.getByRole("heading", { name: "What do you need?" }),
  ).toBeVisible();

  // Enter with nothing chosen explains what is missing instead of moving on.
  await page.keyboard.press("Enter");
  await expect(page.getByText("Pick a service to continue.")).toBeVisible();

  await page.keyboard.press("a"); // A = Photography
  await page.getByRole("button", { name: "Wedding", exact: true }).click();
  await expect(
    page.getByRole("region", { name: /Call sheet/ }).first(),
  ).toContainText("Photography · Wedding");
  await page.getByRole("button", { name: "Next", exact: true }).first().click();

  const shoot = futureWeekday(40);
  await expect(page.getByRole("heading", { name: "When?" })).toBeVisible();
  await page.getByLabel("Shoot date").fill(shoot.typed);
  await page.getByRole("radio", { name: "This exact day" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).first().click();

  await expect(page.getByRole("heading", { name: "Where?" })).toBeVisible();
  await page.getByLabel("Province/city").selectOption(province.id);
  await page.getByRole("button", { name: "Next", exact: true }).first().click();

  // Style is optional.
  await expect(
    page.getByRole("heading", { name: "What style do you like?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).first().click();

  await expect(
    page.getByRole("heading", { name: "Roughly what budget?" }),
  ).toBeVisible();
  await page.keyboard.press("f"); // F = let the artist quote
  await page.getByRole("button", { name: "Next", exact: true }).first().click();

  await expect(
    page.getByRole("heading", { name: "Anything else artists should know?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send request" }).first().click();
  await expect(
    page.getByRole("heading", { name: /^Request YC-\d{4}-\d+ has been sent$/ }),
  ).toBeVisible({ timeout: 15_000 });

  const request = await db.serviceRequest.findFirstOrThrow({
    where: { customerId: customer.id },
  });
  expect(request.status).toBe("PENDING_REVIEW");
  expect(request.role).toBe("PHOTOGRAPHER");
  expect(request.shootDate?.toISOString().slice(0, 10)).toBe(shoot.iso);
  expect(request.budgetMin).toBeNull();
  expect(request.budgetMax).toBeNull();

  // --- Approval and two proposals (the admin and provider sides have their
  // own coverage; here they are only the setup) ----------------------------
  const prices = [3_500_000, 4_200_000];
  const providers = [];
  for (const [i, price] of prices.entries()) {
    const user = await createUser({
      email: `offerer${i}.${stamp}@e2e.test`,
      username: `offerer${i}${stamp}`,
      firstName: `Offer${i}`,
      lastName: "Photo",
      roles: ["PHOTOGRAPHER"],
    });
    await activatePaidRole(user.id, "PHOTOGRAPHER");
    await createPublishedProfile({
      userId: user.id,
      role: "PHOTOGRAPHER",
      displayName: `Offer Studio ${i}`,
      provinceId: province.id,
    });
    await seedWeekdayAvailability(user.id);
    await db.requestOffer.create({
      data: {
        requestId: request.id,
        providerId: user.id,
        proposedPrice: price,
        proposedDate: new Date(`${shoot.iso}T00:00:00.000Z`),
        message: `Proposal ${i}: full day, edited photos within two weeks.`,
      },
    });
    providers.push(user);
  }
  await db.serviceRequest.update({
    where: { id: request.id },
    data: {
      status: "HAS_OFFERS",
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });

  // --- Proposals: price first, honest rating, compare, choose --------------
  await page.goto(`/dashboard/requests/${request.id}`);
  await expect(page.getByRole("heading", { name: "2 offers" })).toBeVisible();
  await expect(page.getByText("No reviews yet")).toHaveCount(2);
  await expect(page.getByText("7 days left")).toBeVisible();

  await page.getByLabel("Compare").first().check();
  await page.getByLabel("Compare").nth(1).check();
  const tray = page.getByRole("region", { name: "Compare tray" });
  await expect(tray).toContainText("2/3 proposals selected");
  await tray.getByRole("button", { name: "Compare" }).click();

  const table = page.getByRole("dialog", { name: "Compare 2 proposals" });
  await expect(table).toContainText("Offer Studio 0");
  await expect(table).toContainText("Offer Studio 1");
  await expect(table).toContainText("3.500.000");
  await table.getByRole("button", { name: "Accept" }).first().click();

  const confirm = page.getByRole("dialog", { name: "Confirm booking" });
  await expect(confirm).toContainText("Offer Studio 0");
  await confirm.getByLabel("Start time").fill("10:00");
  await confirm.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bookings\//, { timeout: 15_000 });

  const after = await db.serviceRequest.findUniqueOrThrow({
    where: { id: request.id },
  });
  expect(after.status).toBe("FULFILLED");
});
