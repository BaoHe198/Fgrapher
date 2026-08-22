import { expect, test } from "@playwright/test";

import { createUser, db, TEST_PASSWORD } from "./helpers/db";
import { login } from "./helpers/auth";

test("customer messages the fixture provider and gets a reply", async ({ page, browser }) => {
  // Polling-based delivery (4s interval) against a real, remote database
  // round-trip regularly pushes this past a "normal" test's timeout budget
  // under parallel-worker contention — that's a property of the
  // architecture (see e2e/README.md), not a flake to hide with an
  // ever-larger fixed timeout.
  test.slow();

  const uniqueFirstName = `Msgr${Date.now()}`;
  const customer = await createUser({
    email: `messenger.${Date.now()}@e2e.test`,
    username: `messenger${Date.now()}`,
    firstName: uniqueFirstName,
    lastName: "Customer",
  });
  const provider = await db.user.findUniqueOrThrow({ where: { username: "fixtureprovider" } });

  await login(page, customer.email, TEST_PASSWORD);
  await page.goto(`/dashboard/messages?to=${provider.id}`);

  const customerMessage = `Hi, is ${new Date().toISOString()} available?`;
  await page.getByPlaceholder("Write a message...").fill(customerMessage);
  await page.getByRole("button", { name: "Send message" }).click();
  // Sender sees their own message immediately (chat-panel.tsx reloads on
  // send) — no polling wait needed on this side.
  await expect(page.getByText(customerMessage)).toBeVisible({ timeout: 10_000 });

  const providerContext = await browser.newContext();
  const providerPage = await providerContext.newPage();
  await login(providerPage, "fixture-provider@e2e.test", TEST_PASSWORD);
  await providerPage.goto("/dashboard/messages");
  await providerPage.getByRole("button").filter({ hasText: uniqueFirstName }).click();
  // Cross-tab delivery is polling-based (4s interval, no live transport —
  // see e2e/README.md), so this genuinely needs to wait, not just assert.
  await expect(providerPage.getByText(customerMessage)).toBeVisible({ timeout: 45_000 });

  const providerReply = `Yes! Let's confirm a time. — ${Date.now()}`;
  await providerPage.getByPlaceholder("Write a message...").fill(providerReply);
  await providerPage.getByRole("button", { name: "Send message" }).click();
  await expect(providerPage.getByText(providerReply)).toBeVisible({ timeout: 10_000 });

  // The customer tab has been backgrounded (uninteracted-with, a different
  // context in front) for the last ~10-20s — Chromium throttles
  // setInterval on backgrounded pages, which can silently stretch the 4s
  // poll interval well past it. Foreground it so the poll actually runs at
  // its intended cadence instead of intermittently timing out here.
  await page.bringToFront();
  await expect(page.getByText(providerReply)).toBeVisible({ timeout: 45_000 });
  await providerContext.close();

  // Scoped to this test's customer, not the shared fixture provider (who
  // accumulates conversations across every run of this test) — otherwise
  // this picks up unrelated messages from prior runs.
  const messages = await db.message.findMany({
    where: { OR: [{ senderId: customer.id }, { receiverId: customer.id }] },
    orderBy: { createdAt: "asc" },
  });
  expect(messages.map((m) => m.content)).toEqual([customerMessage, providerReply]);
});
