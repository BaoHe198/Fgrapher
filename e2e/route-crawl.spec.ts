import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { createUser, TEST_PASSWORD } from "./helpers/db";

// Prompt G1 (docs/guides/fgrapher-prompt-dot-2.md) — "chặn tái diễn bằng
// test". Two /dashboard/* nav links (profile, billing) and the whole
// /dashboard/settings index have now 404'd across two separate rounds of
// manual fixes — a real regression risk, not a one-off. This crawls every
// link actually rendered in the sidebar/header/footer for each role and
// fails if any of them resolve to a 404, so a future stale href gets
// caught here instead of by a user clicking it.

const EXCLUDED_PREFIXES = ["/api/", "mailto:", "http://", "https://", "#"];

async function collectInternalLinks(page: import("@playwright/test").Page) {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
  const unique = new Set(
    hrefs.filter(
      (href) =>
        href.startsWith("/") &&
        !EXCLUDED_PREFIXES.some((prefix) => href.startsWith(prefix)),
    ),
  );
  return Array.from(unique);
}

async function assertNoBrokenLinks(
  page: import("@playwright/test").Page,
  links: string[],
) {
  for (const href of links) {
    const response = await page.request.get(href);
    expect(response.status(), `${href} returned ${response.status()}`).not.toBe(
      404,
    );
  }
}

test("CUSTOMER: every sidebar/header/footer link resolves", async ({
  page,
}) => {
  const timestamp = Date.now();
  const user = await createUser({
    email: `crawlcust.${timestamp}@e2e.test`,
    username: `crawlcust${timestamp}`,
    firstName: "Crawl",
    lastName: "Customer",
    roles: ["CUSTOMER"],
  });
  await login(page, user.email, TEST_PASSWORD);

  await page.goto("/dashboard");
  const dashboardLinks = await collectInternalLinks(page);

  await page.goto("/");
  const homeLinks = await collectInternalLinks(page);

  await assertNoBrokenLinks(page, [
    ...new Set([...dashboardLinks, ...homeLinks]),
  ]);
});

test("PHOTOGRAPHER: every sidebar/header/footer link resolves, including provider-only nav items", async ({
  page,
}) => {
  const timestamp = Date.now();
  const user = await createUser({
    email: `crawlphoto.${timestamp}@e2e.test`,
    username: `crawlphoto${timestamp}`,
    firstName: "Crawl",
    lastName: "Photographer",
    roles: ["PHOTOGRAPHER"],
  });
  await login(page, user.email, TEST_PASSWORD);

  await page.goto("/dashboard");
  const dashboardLinks = await collectInternalLinks(page);
  // Calendar and reviews only render for canReceiveBookings roles — assert
  // they're actually present, not just that whatever's there is valid.
  expect(dashboardLinks).toContain("/dashboard/calendar");
  expect(dashboardLinks).toContain("/dashboard/reviews");
  expect(dashboardLinks).toContain("/dashboard/portfolio");

  await assertNoBrokenLinks(page, dashboardLinks);
});

test("MODEL: every sidebar/header/footer link resolves", async ({ page }) => {
  const timestamp = Date.now();
  const user = await createUser({
    email: `crawlmodel.${timestamp}@e2e.test`,
    username: `crawlmodel${timestamp}`,
    firstName: "Crawl",
    lastName: "Model",
    roles: ["MODEL"],
  });
  await login(page, user.email, TEST_PASSWORD);

  await page.goto("/dashboard");
  const dashboardLinks = await collectInternalLinks(page);
  await assertNoBrokenLinks(page, dashboardLinks);
});

test("ADMIN: every sidebar/header link resolves, including the admin section", async ({
  page,
}) => {
  const timestamp = Date.now();
  const user = await createUser({
    email: `crawladmin.${timestamp}@e2e.test`,
    username: `crawladmin${timestamp}`,
    firstName: "Crawl",
    lastName: "Admin",
    roles: ["ADMIN"],
  });
  await login(page, user.email, TEST_PASSWORD);

  await page.goto("/dashboard");
  const dashboardLinks = await collectInternalLinks(page);
  // The admin-only sidebar entry must actually be present for an ADMIN
  // account — this is exactly the kind of role-gated item VIỆC 4 warns
  // could get silently skipped by a test account that doesn't see it.
  expect(dashboardLinks).toContain("/admin");

  await page.goto("/admin");
  const adminLinks = await collectInternalLinks(page);
  expect(adminLinks).toContain("/admin/moderation");
  expect(adminLinks).toContain("/admin/users");
  expect(adminLinks).toContain("/admin/reports");
  expect(adminLinks).toContain("/admin/verifications");
  expect(adminLinks).toContain("/admin/compliance");

  await assertNoBrokenLinks(page, [
    ...new Set([...dashboardLinks, ...adminLinks]),
  ]);
});
