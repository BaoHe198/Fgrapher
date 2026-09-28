import { expect, test } from "@playwright/test";

// A first-time visitor, not the pre-answered browser every other spec uses.
test.use({ storageState: { cookies: [], origins: [] } });

test("first visit asks about cookies; the answer sticks and can be changed", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: /cookie/i });
  await expect(banner).toBeVisible();

  // Neither answer is pre-selected: both are plain buttons of equal weight.
  await banner.getByRole("button").first().click();
  await expect(banner).toBeHidden();

  const stored = (await context.cookies()).find(
    (c) => c.name === "fg_cookie_consent",
  );
  expect(decodeURIComponent(stored?.value ?? "")).toContain('"a":0');

  await page.reload();
  await expect(banner).toBeHidden();

  // The footer link brings it back to change the answer.
  await page.locator("footer").getByRole("button").click();
  await expect(banner).toBeVisible();
  await banner.getByRole("button").nth(1).click();
  await expect(banner).toBeHidden();
  const updated = (await context.cookies()).find(
    (c) => c.name === "fg_cookie_consent",
  );
  expect(decodeURIComponent(updated?.value ?? "")).toContain('"a":1');
});
